from uuid import UUID
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_optional_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.menu import (
    MenuCategoryCreate,
    MenuCategoryResponse,
    MenuCategoryUpdate,
    MenuItemCreate,
    MenuItemResponse,
    MenuItemUpdate,
)
from app.services.menu_service import MenuService

router = APIRouter(tags=["Menu"])


# ---------------------------------------------------------------------------
# CATEGORY ENDPOINTS
# ---------------------------------------------------------------------------

@router.get("/menu/categories", response_model=list[MenuCategoryResponse], summary="List menu categories (with nested items)")
def list_categories(
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return MenuService(db).list_categories(current_user)


@router.post("/menu/categories", response_model=MenuCategoryResponse, status_code=status.HTTP_201_CREATED, summary="Create menu category")
def create_category(
    data: MenuCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return MenuService(db).create_category(current_user, data)


@router.get("/menu/categories/{category_id}", response_model=MenuCategoryResponse, summary="Get menu category details")
def get_category(
    category_id: UUID,
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return MenuService(db).get_category(current_user, category_id)


@router.put("/menu/categories/{category_id}", response_model=MenuCategoryResponse, summary="Update menu category")
def update_category(
    category_id: UUID,
    data: MenuCategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return MenuService(db).update_category(current_user, category_id, data)


@router.delete("/menu/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete menu category (cascades to items)")
def delete_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    MenuService(db).delete_category(current_user, category_id)
    return None


# ---------------------------------------------------------------------------
# ITEM ENDPOINTS
# ---------------------------------------------------------------------------

@router.get("/menu/items", response_model=list[MenuItemResponse], summary="List all menu items")
def list_items(
    category_id: UUID | None = Query(default=None),
    available_only: bool = Query(default=False),
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return MenuService(db).list_items(current_user, category_id=category_id, available_only=available_only)


@router.post("/menu/items", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED, summary="Create menu item")
def create_item(
    data: MenuItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return MenuService(db).create_item(current_user, data)


@router.get("/menu/items/{item_id}", response_model=MenuItemResponse, summary="Get menu item details")
def get_item(
    item_id: UUID,
    current_user: User = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    return MenuService(db).get_item(current_user, item_id)


@router.put("/menu/items/{item_id}", response_model=MenuItemResponse, summary="Update menu item")
def update_item(
    item_id: UUID,
    data: MenuItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return MenuService(db).update_item(current_user, item_id, data)


@router.delete("/menu/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete menu item")
def delete_item(
    item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    MenuService(db).delete_item(current_user, item_id)
    return None
