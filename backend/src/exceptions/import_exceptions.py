"""
Custom exceptions for import/export operations.
"""

from fastapi import HTTPException
from typing import Optional, Dict, Any


class ImportValidationError(HTTPException):
    """Exception raised when import validation fails."""

    def __init__(self, detail: str, status_code: int = 400):
        super().__init__(status_code=status_code, detail=detail)


class DuplicateDataError(HTTPException):
    """Exception raised when duplicate data is detected during import."""

    def __init__(self, detail: str, duplicates: Optional[Dict[str, Any]] = None, status_code: int = 409):
        self.duplicates = duplicates
        super().__init__(status_code=status_code, detail=detail)


class FileProcessingError(HTTPException):
    """Exception raised when file processing fails."""

    def __init__(self, detail: str, status_code: int = 422):
        super().__init__(status_code=status_code, detail=detail)


class ExportError(HTTPException):
    """Exception raised when export operation fails."""

    def __init__(self, detail: str, status_code: int = 500):
        super().__init__(status_code=status_code, detail=detail)


class BackupError(HTTPException):
    """Exception raised when backup/restore operation fails."""

    def __init__(self, detail: str, status_code: int = 500):
        super().__init__(status_code=status_code, detail=detail)


class IntegrationError(HTTPException):
    """Exception raised when integration operation fails."""

    def __init__(self, detail: str, status_code: int = 502):
        super().__init__(status_code=status_code, detail=detail)