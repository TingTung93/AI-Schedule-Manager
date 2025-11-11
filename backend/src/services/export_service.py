"""
Export service for data export functionality.
Supports CSV, Excel, PDF, and iCal format exports.
"""

import asyncio
import io
import logging
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from icalendar import Calendar, Event
import xlsxwriter

from ..models import Employee, Schedule, Rule, Shift
from ..schemas import EmployeeResponse, ScheduleResponse, RuleResponse

logger = logging.getLogger(__name__)


class ExportService:
    """Service for handling data exports."""

    def __init__(self):
        self.supported_formats = ["csv", "excel", "pdf", "ical"]

    async def export_employees(
        self, db: AsyncSession, format_type: str, filters: Optional[Dict[str, Any]] = None, include_inactive: bool = False
    ) -> bytes:
        """Export employees data in specified format."""
        try:
            # Build query with filters
            query = select(Employee)

            if not include_inactive:
                query = query.where(Employee.active == True)

            if filters:
                if filters.get("role"):
                    query = query.where(Employee.role == filters["role"])
                if filters.get("search"):
                    search_term = f"%{filters['search']}%"
                    query = query.where(or_(Employee.name.ilike(search_term), Employee.email.ilike(search_term)))

            result = await db.execute(query)
            employees = result.scalars().all()

            # Convert to export format
            data = []
            for emp in employees:
                data.append(
                    {
                        "ID": emp.id,
                        "Name": emp.name,
                        "Email": emp.email,
                        "Role": emp.role,
                        "Phone": emp.phone or "",
                        "Hourly Rate": emp.hourly_rate or 0,
                        "Max Hours/Week": emp.max_hours_per_week or 40,
                        "Qualifications": ", ".join(emp.qualifications or []),
                        "Active": "Yes" if emp.active else "No",
                        "Created": emp.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    }
                )

            return await self._export_data(data, format_type, "employees")

        except Exception as e:
            logger.error(f"Error exporting employees: {e}")
            raise

    async def export_schedules(
        self,
        db: AsyncSession,
        format_type: str,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        employee_ids: Optional[List[int]] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        """Export schedules data in specified format."""
        try:
            # Build query with joins
            query = select(Schedule).join(Employee).join(Shift)

            # Apply date filters
            if date_from:
                query = query.where(Schedule.date >= date_from)
            if date_to:
                query = query.where(Schedule.date <= date_to)

            # Apply employee filter
            if employee_ids:
                query = query.where(Schedule.employee_id.in_(employee_ids))

            # Apply additional filters
            if filters:
                if filters.get("status"):
                    query = query.where(Schedule.status == filters["status"])

            result = await db.execute(query)
            schedules = result.scalars().all()

            # Convert to export format
            data = []
            for schedule in schedules:
                data.append(
                    {
                        "Schedule ID": schedule.id,
                        "Employee": schedule.employee.name,
                        "Employee Email": schedule.employee.email,
                        "Shift": schedule.shift.name,
                        "Date": schedule.date.strftime("%Y-%m-%d"),
                        "Start Time": schedule.shift.start_time.strftime("%H:%M"),
                        "End Time": schedule.shift.end_time.strftime("%H:%M"),
                        "Department": schedule.shift.department or "",
                        "Status": schedule.status,
                        "Overtime Approved": "Yes" if schedule.overtime_approved else "No",
                        "Notes": schedule.notes or "",
                        "Created": schedule.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    }
                )

            if format_type == "ical":
                return await self._export_ical(data)

            return await self._export_data(data, format_type, "schedules")

        except Exception as e:
            logger.error(f"Error exporting schedules: {e}")
            raise

    async def export_rules(
        self, db: AsyncSession, format_type: str, filters: Optional[Dict[str, Any]] = None, include_inactive: bool = False
    ) -> bytes:
        """Export rules data in specified format."""
        try:
            # Build query
            query = select(Rule).join(Employee, Rule.employee_id == Employee.id, isouter=True)

            if not include_inactive:
                query = query.where(Rule.active == True)

            if filters:
                if filters.get("rule_type"):
                    query = query.where(Rule.rule_type == filters["rule_type"])
                if filters.get("employee_id"):
                    query = query.where(Rule.employee_id == filters["employee_id"])

            result = await db.execute(query)
            rules = result.scalars().all()

            # Convert to export format
            data = []
            for rule in rules:
                data.append(
                    {
                        "Rule ID": rule.id,
                        "Type": rule.rule_type,
                        "Original Text": rule.original_text,
                        "Priority": rule.priority,
                        "Employee": rule.employee.name if rule.employee else "All",
                        "Constraints": str(rule.constraints),
                        "Active": "Yes" if rule.active else "No",
                        "Created": rule.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                    }
                )

            return await self._export_data(data, format_type, "rules")

        except Exception as e:
            logger.error(f"Error exporting rules: {e}")
            raise

    async def export_analytics_report(
        self, db: AsyncSession, format_type: str, date_from: Optional[date] = None, date_to: Optional[date] = None
    ) -> bytes:
        """Export analytics report."""
        try:
            # Calculate analytics data
            analytics_data = await self._calculate_analytics(db, date_from, date_to)

            if format_type == "pdf":
                return await self._export_analytics_pdf(analytics_data)
            else:
                return await self._export_data(analytics_data, format_type, "analytics_report")

        except Exception as e:
            logger.error(f"Error exporting analytics: {e}")
            raise

    async def _export_data(self, data: List[Dict], format_type: str, filename_prefix: str) -> bytes:
        """Export data to specified format."""
        if not data:
            # Return empty file for no data
            if format_type == "csv":
                return b"No data available\n"
            elif format_type == "excel":
                return await self._create_empty_excel()
            elif format_type == "pdf":
                return await self._create_empty_pdf()

        if format_type == "csv":
            return await self._export_csv(data)
        elif format_type == "excel":
            return await self._export_excel(data, filename_prefix)
        elif format_type == "pdf":
            return await self._export_pdf(data, filename_prefix)
        else:
            raise ValueError(f"Unsupported format: {format_type}")

    async def _export_csv(self, data: List[Dict]) -> bytes:
        """Export data to CSV format."""
        df = pd.DataFrame(data)
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False, encoding="utf-8")
        return csv_buffer.getvalue().encode("utf-8")

    async def _export_excel(self, data: List[Dict], sheet_name: str) -> bytes:
        """Export data to Excel format."""
        excel_buffer = io.BytesIO()

        # Create workbook with xlsxwriter for better formatting
        workbook = xlsxwriter.Workbook(excel_buffer)
        worksheet = workbook.add_worksheet(sheet_name.capitalize())

        # Define formats
        header_format = workbook.add_format({"bold": True, "bg_color": "#4F81BD", "font_color": "white", "border": 1})

        cell_format = workbook.add_format({"border": 1, "align": "left", "valign": "top", "text_wrap": True})

        # Write headers
        if data:
            headers = list(data[0].keys())
            for col, header in enumerate(headers):
                worksheet.write(0, col, header, header_format)
                # Auto-adjust column width
                worksheet.set_column(col, col, min(max(len(str(header)), 10), 50))

            # Write data
            for row, item in enumerate(data, 1):
                for col, header in enumerate(headers):
                    value = item.get(header, "")
                    worksheet.write(row, col, value, cell_format)

        workbook.close()
        excel_buffer.seek(0)
        return excel_buffer.getvalue()

    async def _export_pdf(self, data: List[Dict], title: str) -> bytes:
        """Export data to PDF format."""
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=A4)
        elements = []

        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CustomTitle", parent=styles["Heading1"], fontSize=16, spaceAfter=30, alignment=1  # Center alignment
        )

        # Add title
        title_text = f"{title.replace('_', ' ').title()} Report"
        elements.append(Paragraph(title_text, title_style))
        elements.append(Spacer(1, 12))

        # Add generation info
        info_style = styles["Normal"]
        info_text = f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        elements.append(Paragraph(info_text, info_style))
        elements.append(Spacer(1, 20))

        if data:
            # Create table
            headers = list(data[0].keys())
            table_data = [headers]

            for item in data:
                row = [str(item.get(header, "")) for header in headers]
                table_data.append(row)

            # Create table with styling
            table = Table(table_data)
            table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, 0), 10),
                        ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                        ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
                        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                        ("FONTSIZE", (0, 1), (-1, -1), 8),
                        ("GRID", (0, 0), (-1, -1), 1, colors.black),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ]
                )
            )

            elements.append(table)
        else:
            elements.append(Paragraph("No data available", styles["Normal"]))

        # Build PDF
        doc.build(elements)
        pdf_buffer.seek(0)
        return pdf_buffer.getvalue()

    async def _export_ical(self, schedule_data: List[Dict]) -> bytes:
        """Export schedule data to iCal format."""
        cal = Calendar()
        cal.add("prodid", "-//AI Schedule Manager//Schedule Export//EN")
        cal.add("version", "2.0")
        cal.add("calscale", "GREGORIAN")
        cal.add("method", "PUBLISH")

        for schedule in schedule_data:
            event = Event()

            # Parse date and times
            schedule_date = datetime.strptime(schedule["Date"], "%Y-%m-%d").date()
            start_time = datetime.strptime(schedule["Start Time"], "%H:%M").time()
            end_time = datetime.strptime(schedule["End Time"], "%H:%M").time()

            # Create datetime objects
            start_datetime = datetime.combine(schedule_date, start_time)
            end_datetime = datetime.combine(schedule_date, end_time)

            event.add("summary", f"{schedule['Shift']} - {schedule['Employee']}")
            event.add("dtstart", start_datetime)
            event.add("dtend", end_datetime)
            event.add(
                "description",
                f"Employee: {schedule['Employee']}\n"
                f"Department: {schedule['Department']}\n"
                f"Status: {schedule['Status']}\n"
                f"Notes: {schedule['Notes']}",
            )
            event.add("location", schedule["Department"] or "Workplace")
            event.add("uid", f"schedule-{schedule['Schedule ID']}@ai-schedule-manager.com")
            event.add("priority", 5)

            cal.add_component(event)

        return cal.to_ical()

    async def _calculate_analytics(
        self, db: AsyncSession, date_from: Optional[date] = None, date_to: Optional[date] = None
    ) -> List[Dict]:
        """Calculate analytics data for export."""
        # Set default date range if not provided
        if not date_to:
            date_to = date.today()
        if not date_from:
            date_from = date_to - timedelta(days=30)

        # Get schedules in date range
        query = select(Schedule).join(Employee).join(Shift).where(and_(Schedule.date >= date_from, Schedule.date <= date_to))
        result = await db.execute(query)
        schedules = result.scalars().all()

        # Calculate metrics
        total_schedules = len(schedules)
        total_hours = sum(
            [
                (datetime.combine(date.today(), s.shift.end_time) - datetime.combine(date.today(), s.shift.start_time)).seconds
                / 3600
                for s in schedules
            ]
        )

        # Group by employee
        employee_stats = {}
        for schedule in schedules:
            emp_id = schedule.employee_id
            if emp_id not in employee_stats:
                employee_stats[emp_id] = {"name": schedule.employee.name, "schedules": 0, "hours": 0, "cost": 0}

            hours = (
                datetime.combine(date.today(), schedule.shift.end_time)
                - datetime.combine(date.today(), schedule.shift.start_time)
            ).seconds / 3600

            employee_stats[emp_id]["schedules"] += 1
            employee_stats[emp_id]["hours"] += hours
            employee_stats[emp_id]["cost"] += hours * (schedule.employee.hourly_rate or 0)

        # Create analytics data
        analytics_data = [
            {"Metric": "Report Period", "Value": f"{date_from} to {date_to}", "Description": "Date range for this report"},
            {"Metric": "Total Schedules", "Value": total_schedules, "Description": "Number of scheduled shifts"},
            {"Metric": "Total Hours", "Value": f"{total_hours:.1f}", "Description": "Total scheduled hours"},
            {
                "Metric": "Average Hours per Schedule",
                "Value": f"{total_hours/total_schedules:.1f}" if total_schedules > 0 else "0",
                "Description": "Average shift duration",
            },
        ]

        # Add employee statistics
        for emp_data in employee_stats.values():
            analytics_data.extend(
                [
                    {
                        "Metric": f"{emp_data['name']} - Schedules",
                        "Value": emp_data["schedules"],
                        "Description": f"Number of shifts for {emp_data['name']}",
                    },
                    {
                        "Metric": f"{emp_data['name']} - Hours",
                        "Value": f"{emp_data['hours']:.1f}",
                        "Description": f"Total hours for {emp_data['name']}",
                    },
                    {
                        "Metric": f"{emp_data['name']} - Cost",
                        "Value": f"${emp_data['cost']:.2f}",
                        "Description": f"Total labor cost for {emp_data['name']}",
                    },
                ]
            )

        return analytics_data

    async def _export_analytics_pdf(self, analytics_data: List[Dict]) -> bytes:
        """Export analytics as a formatted PDF report."""
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=A4)
        elements = []

        styles = getSampleStyleSheet()

        # Title
        title_style = ParagraphStyle("ReportTitle", parent=styles["Heading1"], fontSize=20, spaceAfter=30, alignment=1)
        elements.append(Paragraph("Analytics Report", title_style))

        # Subtitle
        subtitle_style = ParagraphStyle("ReportSubtitle", parent=styles["Heading2"], fontSize=14, spaceAfter=20, alignment=1)
        elements.append(Paragraph("AI Schedule Manager", subtitle_style))
        elements.append(Spacer(1, 20))

        # Generation info
        info_text = f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        elements.append(Paragraph(info_text, styles["Normal"]))
        elements.append(Spacer(1, 30))

        # Analytics table
        table_data = [["Metric", "Value", "Description"]]
        for item in analytics_data:
            table_data.append([item["Metric"], str(item["Value"]), item["Description"]])

        table = Table(table_data, colWidths=[2 * inch, 1 * inch, 3 * inch])
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.darkblue),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                    ("BACKGROUND", (0, 1), (-1, -1), colors.lightgrey),
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 1), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 1, colors.black),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )

        elements.append(table)

        doc.build(elements)
        pdf_buffer.seek(0)
        return pdf_buffer.getvalue()

    async def _create_empty_excel(self) -> bytes:
        """Create an empty Excel file."""
        excel_buffer = io.BytesIO()
        workbook = xlsxwriter.Workbook(excel_buffer)
        worksheet = workbook.add_worksheet("Empty")
        worksheet.write(0, 0, "No data available")
        workbook.close()
        excel_buffer.seek(0)
        return excel_buffer.getvalue()

    async def _create_empty_pdf(self) -> bytes:
        """Create an empty PDF file."""
        pdf_buffer = io.BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=A4)
        styles = getSampleStyleSheet()
        elements = [Paragraph("No data available", styles["Normal"])]
        doc.build(elements)
        pdf_buffer.seek(0)
        return pdf_buffer.getvalue()
