"""
Data Import/Export API endpoints.
"""

import asyncio
import logging
from datetime import date, datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, BackgroundTasks, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ..dependencies import get_database_session, get_current_user, get_current_manager
from ..services.export_service import ExportService
from ..services.import_service import ImportService
from ..services.file_handler import file_handler
from ..services.backup_service import BackupService
from ..schemas import PaginatedResponse
from ..exceptions.import_exceptions import ImportValidationError, FileProcessingError

router = APIRouter(prefix="/api/data", tags=["Data Import/Export"])
logger = logging.getLogger(__name__)

# Service instances
export_service = ExportService()
import_service = ImportService()
backup_service = BackupService()


# Export endpoints
@router.get("/export/employees")
async def export_employees(
    format_type: str = Query(..., regex="^(csv|excel|pdf)$"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    include_inactive: bool = Query(False)
):
    """Export employees data in specified format."""
    try:
        filters = {}
        if role:
            filters['role'] = role
        if search:
            filters['search'] = search

        content = await export_service.export_employees(
            db=db,
            format_type=format_type,
            filters=filters,
            include_inactive=include_inactive
        )

        # Determine content type and filename
        content_types = {
            'csv': 'text/csv',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf'
        }

        extensions = {
            'csv': 'csv',
            'excel': 'xlsx',
            'pdf': 'pdf'
        }

        filename = f"employees_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{extensions[format_type]}"

        return Response(
            content=content,
            media_type=content_types[format_type],
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        logger.error(f"Employee export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/schedules")
async def export_schedules(
    format_type: str = Query(..., regex="^(csv|excel|pdf|ical)$"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_user),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    employee_ids: Optional[List[int]] = Query(None),
    status: Optional[str] = Query(None)
):
    """Export schedules data in specified format."""
    try:
        filters = {}
        if status:
            filters['status'] = status

        content = await export_service.export_schedules(
            db=db,
            format_type=format_type,
            date_from=date_from,
            date_to=date_to,
            employee_ids=employee_ids,
            filters=filters
        )

        content_types = {
            'csv': 'text/csv',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf',
            'ical': 'text/calendar'
        }

        extensions = {
            'csv': 'csv',
            'excel': 'xlsx',
            'pdf': 'pdf',
            'ical': 'ics'
        }

        filename = f"schedules_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{extensions[format_type]}"

        return Response(
            content=content,
            media_type=content_types[format_type],
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        logger.error(f"Schedule export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/rules")
async def export_rules(
    format_type: str = Query(..., regex="^(csv|excel|pdf)$"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
    rule_type: Optional[str] = Query(None),
    employee_id: Optional[int] = Query(None),
    include_inactive: bool = Query(False)
):
    """Export rules data in specified format."""
    try:
        filters = {}
        if rule_type:
            filters['rule_type'] = rule_type
        if employee_id:
            filters['employee_id'] = employee_id

        content = await export_service.export_rules(
            db=db,
            format_type=format_type,
            filters=filters,
            include_inactive=include_inactive
        )

        content_types = {
            'csv': 'text/csv',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf'
        }

        extensions = {
            'csv': 'csv',
            'excel': 'xlsx',
            'pdf': 'pdf'
        }

        filename = f"rules_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{extensions[format_type]}"

        return Response(
            content=content,
            media_type=content_types[format_type],
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        logger.error(f"Rules export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/analytics")
async def export_analytics_report(
    format_type: str = Query(..., regex="^(csv|excel|pdf)$"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None)
):
    """Export analytics report."""
    try:
        content = await export_service.export_analytics_report(
            db=db,
            format_type=format_type,
            date_from=date_from,
            date_to=date_to
        )

        content_types = {
            'csv': 'text/csv',
            'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pdf': 'application/pdf'
        }

        extensions = {
            'csv': 'csv',
            'excel': 'xlsx',
            'pdf': 'pdf'
        }

        filename = f"analytics_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{extensions[format_type]}"

        return Response(
            content=content,
            media_type=content_types[format_type],
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        logger.error(f"Analytics export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Import endpoints
@router.post("/import/upload")
async def upload_import_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_manager)
):
    """Upload file for import processing."""
    try:
        file_info = await file_handler.validate_and_process_upload(
            file=file,
            allowed_extensions=['.csv', '.xlsx', '.xls'],
            max_size=50 * 1024 * 1024  # 50MB
        )

        return {
            "file_id": file_info['file_id'],
            "filename": file_info['filename'],
            "size": file_info['size'],
            "mime_type": file_info['mime_type'],
            "upload_time": file_info['upload_time'],
            "message": "File uploaded successfully. Use the file_id to preview or import data."
        }

    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/import/preview/{file_id}")
async def preview_import_data(
    file_id: str,
    import_type: str = Query(..., regex="^(employees|schedules|rules)$"),
    preview_rows: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_manager)
):
    """Preview import data before processing."""
    try:
        file_content = await file_handler.get_file_content(file_id)
        file_info = await file_handler.get_file_info(file_id)

        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")

        preview = await import_service.preview_import_data(
            file_content=file_content,
            filename=file_info['filename'],
            import_type=import_type,
            preview_rows=preview_rows
        )

        return preview

    except Exception as e:
        logger.error(f"Import preview error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import/validate/{file_id}")
async def validate_import_data(
    file_id: str,
    import_type: str = Query(..., regex="^(employees|schedules|rules)$"),
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager)
):
    """Validate import data for errors and duplicates."""
    try:
        file_content = await file_handler.get_file_content(file_id)
        file_info = await file_handler.get_file_info(file_id)

        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")

        # Create DataFrame for validation
        df = await import_service._read_file_to_dataframe(
            file_content, file_info['filename'], 'utf-8'
        )

        # Run validation checks
        validation_result = await import_service.validate_import_data(db, df, import_type)
        duplicates = await import_service.detect_duplicates(db, df, import_type)

        return {
            "validation": validation_result,
            "duplicates": duplicates,
            "ready_for_import": validation_result['invalid_rows'] == 0
        }

    except Exception as e:
        logger.error(f"Import validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import/execute/{file_id}")
async def execute_import(
    file_id: str,
    import_type: str = Query(..., regex="^(employees|schedules|rules)$"),
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
    update_existing: bool = Query(False),
    column_mapping: Optional[Dict[str, str]] = None
):
    """Execute data import process."""
    try:
        file_content = await file_handler.get_file_content(file_id)
        file_info = await file_handler.get_file_info(file_id)

        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")

        options = {
            'update_existing': update_existing,
            'column_mapping': column_mapping or {}
        }

        # Execute import based on type
        if import_type == 'employees':
            result = await import_service.import_employees(db, file_content, file_info['filename'], options)
        elif import_type == 'schedules':
            result = await import_service.import_schedules(db, file_content, file_info['filename'], options)
        elif import_type == 'rules':
            result = await import_service.import_rules(db, file_content, file_info['filename'], options)
        else:
            raise HTTPException(status_code=400, detail="Invalid import type")

        # Schedule file cleanup
        background_tasks.add_task(file_handler.cleanup_file, file_id)

        return {
            "import_result": result,
            "message": f"Import completed. {result['created']} created, {result['updated']} updated, {result['skipped']} skipped."
        }

    except Exception as e:
        logger.error(f"Import execution error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/import/progress/{file_id}")
async def get_import_progress(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get import progress status."""
    try:
        progress = await file_handler.get_progress(file_id)

        if not progress:
            raise HTTPException(status_code=404, detail="File or progress not found")

        return progress

    except Exception as e:
        logger.error(f"Progress check error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# Backup and restore endpoints
@router.post("/backup/create")
async def create_backup(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
    backup_type: str = Query("full", regex="^(full|incremental)$"),
    include_files: bool = Query(True)
):
    """Create database backup."""
    try:
        backup_id = await backup_service.create_backup(
            db=db,
            backup_type=backup_type,
            include_files=include_files,
            user_id=current_user.get('user_id', 'unknown')
        )

        return {
            "backup_id": backup_id,
            "backup_type": backup_type,
            "status": "started",
            "message": "Backup process started. Check status using backup_id."
        }

    except Exception as e:
        logger.error(f"Backup creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backup/list")
async def list_backups(
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100)
):
    """List available backups."""
    try:
        backups = await backup_service.list_backups(
            skip=(page - 1) * size,
            limit=size
        )

        return PaginatedResponse(
            items=backups['items'],
            total=backups['total'],
            page=page,
            size=size,
            pages=(backups['total'] + size - 1) // size
        )

    except Exception as e:
        logger.error(f"Backup listing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/backup/status/{backup_id}")
async def get_backup_status(
    backup_id: str,
    current_user: dict = Depends(get_current_manager)
):
    """Get backup status and details."""
    try:
        status = await backup_service.get_backup_status(backup_id)

        if not status:
            raise HTTPException(status_code=404, detail="Backup not found")

        return status

    except Exception as e:
        logger.error(f"Backup status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/backup/restore/{backup_id}")
async def restore_backup(
    backup_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_database_session),
    current_user: dict = Depends(get_current_manager),
    verify_before_restore: bool = Query(True)
):
    """Restore from backup."""
    try:
        restore_id = await backup_service.restore_backup(
            backup_id=backup_id,
            db=db,
            verify_before_restore=verify_before_restore,
            user_id=current_user.get('user_id', 'unknown')
        )

        return {
            "restore_id": restore_id,
            "backup_id": backup_id,
            "status": "started",
            "message": "Restore process started. This may take several minutes."
        }

    except Exception as e:
        logger.error(f"Backup restore error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/backup/{backup_id}")
async def delete_backup(
    backup_id: str,
    current_user: dict = Depends(get_current_manager)
):
    """Delete a backup."""
    try:
        success = await backup_service.delete_backup(backup_id)

        if not success:
            raise HTTPException(status_code=404, detail="Backup not found")

        return {"message": "Backup deleted successfully"}

    except Exception as e:
        logger.error(f"Backup deletion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# File management endpoints
@router.get("/files/{file_id}/info")
async def get_file_info(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get file information and status."""
    try:
        file_info = await file_handler.get_file_info(file_id)

        if not file_info:
            raise HTTPException(status_code=404, detail="File not found")

        return file_info

    except Exception as e:
        logger.error(f"File info error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete uploaded file."""
    try:
        await file_handler.cleanup_file(file_id)
        return {"message": "File deleted successfully"}

    except Exception as e:
        logger.error(f"File deletion error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/files/cleanup")
async def cleanup_expired_files(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_manager)
):
    """Clean up expired temporary files."""
    try:
        background_tasks.add_task(file_handler.cleanup_expired_files)
        return {"message": "File cleanup initiated"}

    except Exception as e:
        logger.error(f"File cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))