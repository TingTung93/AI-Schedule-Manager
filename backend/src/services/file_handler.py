"""
File handling service with security, validation, and progress tracking.
"""

import asyncio
import aiofiles
import hashlib
import logging
import magic
import os
import tempfile
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, BinaryIO, AsyncGenerator
from fastapi import UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..exceptions.import_exceptions import FileProcessingError, ImportValidationError

logger = logging.getLogger(__name__)


class FileHandler:
    """Service for handling file uploads, validation, and processing."""

    def __init__(self):
        self.max_file_size = 100 * 1024 * 1024  # 100MB
        self.allowed_mime_types = {
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/pdf',
            'text/calendar'
        }
        self.upload_dir = Path(tempfile.gettempdir()) / "ai_scheduler_uploads"
        self.upload_dir.mkdir(exist_ok=True)

        # File retention settings
        self.retention_hours = 24

        # Progress tracking
        self.progress_store = {}

    async def validate_and_process_upload(
        self,
        file: UploadFile,
        allowed_extensions: Optional[list] = None,
        max_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """Validate and process uploaded file with security checks."""
        try:
            # Generate unique file ID for tracking
            file_id = str(uuid.uuid4())

            # Basic validation
            if not file.filename:
                raise FileProcessingError("No filename provided")

            # Check file extension
            file_extension = Path(file.filename).suffix.lower()
            allowed_ext = allowed_extensions or ['.csv', '.xlsx', '.xls', '.pdf']

            if file_extension not in allowed_ext:
                raise FileProcessingError(f"File type {file_extension} not allowed")

            # Check file size
            max_allowed_size = max_size or self.max_file_size

            # Read file content
            content = await file.read()
            file_size = len(content)

            if file_size > max_allowed_size:
                raise FileProcessingError(f"File size {file_size} exceeds maximum {max_allowed_size}")

            if file_size == 0:
                raise FileProcessingError("Empty file uploaded")

            # Reset file position
            await file.seek(0)

            # MIME type validation
            mime_type = magic.from_buffer(content, mime=True)
            if mime_type not in self.allowed_mime_types:
                logger.warning(f"Suspicious MIME type: {mime_type} for file {file.filename}")
                # Don't fail immediately, but log for security monitoring

            # Calculate file hash for integrity
            file_hash = hashlib.sha256(content).hexdigest()

            # Store file temporarily
            temp_path = await self._store_temp_file(file_id, content)

            # Initialize progress tracking
            self.progress_store[file_id] = {
                'status': 'uploaded',
                'progress': 0,
                'total_size': file_size,
                'processed_size': 0,
                'created_at': datetime.utcnow(),
                'filename': file.filename,
                'file_hash': file_hash
            }

            return {
                'file_id': file_id,
                'filename': file.filename,
                'size': file_size,
                'mime_type': mime_type,
                'file_hash': file_hash,
                'temp_path': str(temp_path),
                'upload_time': datetime.utcnow().isoformat()
            }

        except Exception as e:
            logger.error(f"File upload validation failed: {e}")
            raise FileProcessingError(f"File upload failed: {str(e)}")

    async def _store_temp_file(self, file_id: str, content: bytes) -> Path:
        """Store file temporarily with unique ID."""
        temp_path = self.upload_dir / f"{file_id}.tmp"

        async with aiofiles.open(temp_path, 'wb') as f:
            await f.write(content)

        return temp_path

    async def get_file_content(self, file_id: str) -> bytes:
        """Retrieve file content by ID."""
        try:
            temp_path = self.upload_dir / f"{file_id}.tmp"

            if not temp_path.exists():
                raise FileProcessingError(f"File {file_id} not found or expired")

            async with aiofiles.open(temp_path, 'rb') as f:
                content = await f.read()

            return content

        except Exception as e:
            logger.error(f"Error retrieving file content: {e}")
            raise FileProcessingError(f"Failed to retrieve file: {str(e)}")

    async def update_progress(
        self,
        file_id: str,
        processed_size: int,
        status: str = "processing",
        additional_info: Optional[Dict[str, Any]] = None
    ):
        """Update file processing progress."""
        if file_id in self.progress_store:
            progress_data = self.progress_store[file_id]
            progress_data['processed_size'] = processed_size
            progress_data['status'] = status
            progress_data['progress'] = min(100, (processed_size / progress_data['total_size']) * 100)
            progress_data['updated_at'] = datetime.utcnow()

            if additional_info:
                progress_data.update(additional_info)

    async def get_progress(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get file processing progress."""
        return self.progress_store.get(file_id)

    async def cleanup_file(self, file_id: str):
        """Clean up temporary file."""
        try:
            temp_path = self.upload_dir / f"{file_id}.tmp"
            if temp_path.exists():
                temp_path.unlink()

            # Remove from progress tracking
            self.progress_store.pop(file_id, None)

        except Exception as e:
            logger.error(f"Error cleaning up file {file_id}: {e}")

    async def cleanup_expired_files(self):
        """Clean up expired temporary files."""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=self.retention_hours)

            # Clean up files from filesystem
            for temp_file in self.upload_dir.glob("*.tmp"):
                try:
                    file_stat = temp_file.stat()
                    file_time = datetime.fromtimestamp(file_stat.st_mtime)

                    if file_time < cutoff_time:
                        temp_file.unlink()
                        logger.info(f"Cleaned up expired file: {temp_file}")

                except Exception as e:
                    logger.error(f"Error cleaning up file {temp_file}: {e}")

            # Clean up progress tracking
            expired_files = [
                file_id for file_id, data in self.progress_store.items()
                if data['created_at'] < cutoff_time
            ]

            for file_id in expired_files:
                self.progress_store.pop(file_id, None)

            logger.info(f"Cleaned up {len(expired_files)} expired progress entries")

        except Exception as e:
            logger.error(f"Error during cleanup: {e}")

    async def scan_for_viruses(self, file_path: Path) -> Dict[str, Any]:
        """
        Scan file for viruses using ClamAV (if available).
        This is a placeholder implementation - in production, integrate with actual antivirus.
        """
        try:
            # Placeholder implementation
            # In production, this would integrate with ClamAV or similar

            # Basic checks for suspicious content
            async with aiofiles.open(file_path, 'rb') as f:
                content = await f.read(1024)  # Read first 1KB

            # Check for suspicious patterns (very basic)
            suspicious_patterns = [
                b'<script',
                b'javascript:',
                b'eval(',
                b'exec(',
                b'system(',
            ]

            for pattern in suspicious_patterns:
                if pattern in content.lower():
                    return {
                        'clean': False,
                        'threat': f'Suspicious pattern detected: {pattern.decode("utf-8", errors="ignore")}',
                        'scanner': 'basic_pattern_check'
                    }

            return {
                'clean': True,
                'threat': None,
                'scanner': 'basic_pattern_check'
            }

        except Exception as e:
            logger.error(f"Virus scan failed: {e}")
            return {
                'clean': False,
                'threat': f'Scan failed: {str(e)}',
                'scanner': 'error'
            }

    async def validate_file_integrity(self, file_id: str, expected_hash: str) -> bool:
        """Validate file integrity using hash comparison."""
        try:
            content = await self.get_file_content(file_id)
            actual_hash = hashlib.sha256(content).hexdigest()
            return actual_hash == expected_hash

        except Exception as e:
            logger.error(f"File integrity validation failed: {e}")
            return False

    async def get_file_info(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Get comprehensive file information."""
        progress_data = await self.get_progress(file_id)
        if not progress_data:
            return None

        temp_path = self.upload_dir / f"{file_id}.tmp"

        info = {
            'file_id': file_id,
            'filename': progress_data['filename'],
            'size': progress_data['total_size'],
            'file_hash': progress_data['file_hash'],
            'status': progress_data['status'],
            'progress': progress_data['progress'],
            'created_at': progress_data['created_at'].isoformat(),
            'exists': temp_path.exists()
        }

        if temp_path.exists():
            try:
                stat = temp_path.stat()
                info.update({
                    'actual_size': stat.st_size,
                    'modified_at': datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
            except Exception as e:
                logger.error(f"Error getting file stats: {e}")

        return info

    async def create_chunk_iterator(
        self,
        file_id: str,
        chunk_size: int = 8192
    ) -> AsyncGenerator[bytes, None]:
        """Create an async iterator for processing large files in chunks."""
        try:
            temp_path = self.upload_dir / f"{file_id}.tmp"

            if not temp_path.exists():
                raise FileProcessingError(f"File {file_id} not found")

            processed_size = 0

            async with aiofiles.open(temp_path, 'rb') as f:
                while True:
                    chunk = await f.read(chunk_size)
                    if not chunk:
                        break

                    processed_size += len(chunk)
                    await self.update_progress(
                        file_id,
                        processed_size,
                        "processing"
                    )

                    yield chunk

        except Exception as e:
            logger.error(f"Error creating chunk iterator: {e}")
            raise FileProcessingError(f"Failed to process file: {str(e)}")

    async def export_file_to_response(
        self,
        content: bytes,
        filename: str,
        mime_type: str
    ) -> Dict[str, Any]:
        """Prepare file content for HTTP response."""
        try:
            # Generate a temporary file for download
            download_id = str(uuid.uuid4())
            download_path = self.upload_dir / f"export_{download_id}.tmp"

            async with aiofiles.open(download_path, 'wb') as f:
                await f.write(content)

            # Store download info
            download_info = {
                'download_id': download_id,
                'filename': filename,
                'mime_type': mime_type,
                'size': len(content),
                'created_at': datetime.utcnow(),
                'path': str(download_path)
            }

            # Store in progress tracking for cleanup
            self.progress_store[f"export_{download_id}"] = download_info

            return {
                'download_id': download_id,
                'filename': filename,
                'size': len(content),
                'mime_type': mime_type,
                'ready': True
            }

        except Exception as e:
            logger.error(f"Error preparing export file: {e}")
            raise FileProcessingError(f"Failed to prepare export: {str(e)}")

    async def get_export_content(self, download_id: str) -> bytes:
        """Get content for export download."""
        try:
            download_path = self.upload_dir / f"export_{download_id}.tmp"

            if not download_path.exists():
                raise FileProcessingError(f"Export file {download_id} not found or expired")

            async with aiofiles.open(download_path, 'rb') as f:
                content = await f.read()

            return content

        except Exception as e:
            logger.error(f"Error retrieving export content: {e}")
            raise FileProcessingError(f"Failed to retrieve export: {str(e)}")


# Global file handler instance
file_handler = FileHandler()