class BusinessNotFound(Exception):
    pass


class UserAlreadyExists(Exception):
    pass


class InvalidCredentials(Exception):
    pass

from fastapi import HTTPException, status

class BadRequestException(HTTPException):
    def __init__(self, detail: str = "Bad Request"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=detail
        )