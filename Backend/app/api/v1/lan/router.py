import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.client_device import ClientDevice
from app.models.lan_pairing import LanDevicePairing
from app.models.user import User
from app.schemas.lan import (
    LanPairingClaimRequest,
    LanPairingClaimResponse,
    LanPairingInitiateResponse,
    LanRelayPullResponse,
    LanRelayPushRequest,
    LanRelayPushResponse,
    LanStatusResponse,
)
from app.services.lan_coordinator_service import LanCoordinatorService, is_private_lan_ip

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/lan",
    tags=["POS LAN Coordination"],
)


def verify_private_lan_interface(request: Request):
    """
    Ensures the request originated strictly from a private LAN interface or loopback.
    Rejects public Internet requests with HTTP 403.
    """
    client_host = request.client.host if request.client else None
    # Check forwarded headers if behind local proxy/NAT
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_host = forwarded.split(",")[0].strip()

    if not is_private_lan_ip(client_host):
        logger.warning("Blocked non-private interface access to LAN coordinator from %s", client_host)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: LAN Coordinator endpoints are restricted strictly to private local network interfaces.",
        )


def get_lan_device(
    request: Request,
    authorization: str | None = Header(default=None),
    x_lan_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> tuple[LanDevicePairing, ClientDevice]:
    """
    Dependency that validates the LAN session token from either Authorization or X-LAN-Token header.
    """
    verify_private_lan_interface(request)
    token = x_lan_token or authorization
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required LAN session token (X-LAN-Token or Authorization).",
        )
    return LanCoordinatorService(db).authenticate_lan_token(token)


@router.get(
    "/status",
    response_model=LanStatusResponse,
    summary="Get LAN Coordinator status and node health",
)
def get_coordinator_status(
    request: Request,
    business_id: UUID | None = Query(default=None, description="Optional Business ID to check pairing status"),
    db: Session = Depends(get_db),
):
    verify_private_lan_interface(request)
    return LanCoordinatorService(db).get_status(business_id=business_id)


@router.post(
    "/pairing/initiate",
    response_model=LanPairingInitiateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate short-lived pairing code (authorized business operator on coordinator)",
)
def initiate_device_pairing(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_private_lan_interface(request)
    return LanCoordinatorService(db).initiate_pairing(current_user)


@router.post(
    "/pairing/claim",
    response_model=LanPairingClaimResponse,
    status_code=status.HTTP_200_OK,
    summary="Claim pairing code from Android handheld and receive scoped LAN session token",
)
def claim_device_pairing(
    request: Request,
    req: LanPairingClaimRequest,
    db: Session = Depends(get_db),
):
    verify_private_lan_interface(request)
    return LanCoordinatorService(db).claim_pairing(req)


@router.post(
    "/relay/push",
    response_model=LanRelayPushResponse,
    status_code=status.HTTP_200_OK,
    summary="Relay permitted offline transactions to Windows LAN Coordinator",
)
def relay_push(
    req: LanRelayPushRequest,
    lan_auth: tuple[LanDevicePairing, ClientDevice] = Depends(get_lan_device),
    db: Session = Depends(get_db),
):
    pairing, device = lan_auth
    return LanCoordinatorService(db).relay_push(pairing, device, req)


@router.get(
    "/relay/pull",
    response_model=LanRelayPullResponse,
    status_code=status.HTTP_200_OK,
    summary="Pull live restaurant orders and table statuses from LAN Coordinator",
)
def relay_pull(
    lan_auth: tuple[LanDevicePairing, ClientDevice] = Depends(get_lan_device),
    db: Session = Depends(get_db),
):
    pairing, device = lan_auth
    return LanCoordinatorService(db).relay_pull(pairing, device)


@router.post(
    "/pairing/{device_id}/revoke",
    status_code=status.HTTP_200_OK,
    summary="Revoke paired device LAN access immediately",
)
def revoke_device_pairing(
    device_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    verify_private_lan_interface(request)
    revoked = LanCoordinatorService(db).revoke_device_pairing(current_user, device_id)
    if not revoked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pairing record found for device.",
        )
    return {"status": "success", "message": f"Pairing for device '{device_id}' revoked."}
