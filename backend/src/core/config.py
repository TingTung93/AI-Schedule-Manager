"""
Configuration management for AI Schedule Manager.
Uses Pydantic Settings for environment variable management.
"""

from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings
import os
from pathlib import Path


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Project Info
    PROJECT_NAME: str = "AI Schedule Manager"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    
    # Database
    DATABASE_URL: str = "postgresql://scheduleuser:changeme@localhost:5432/scheduledb"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 50
    REDIS_PASSWORD: Optional[str] = None
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    REFRESH_TOKEN_EXPIRATION_DAYS: int = 30
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:80"]
    CORS_ALLOW_CREDENTIALS: bool = True
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    RATE_LIMIT_BURST_SIZE: int = 10
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    CELERY_TASK_ALWAYS_EAGER: bool = False
    
    # Email (Optional)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[str] = "noreply@aischedulemanager.com"
    EMAILS_FROM_NAME: Optional[str] = "AI Schedule Manager"
    
    # Monitoring
    SENTRY_DSN: Optional[str] = None
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    
    # NLP Configuration
    SPACY_MODEL: str = "en_core_web_sm"
    NLP_CACHE_ENABLED: bool = True
    NLP_CACHE_TTL_SECONDS: int = 3600
    
    # Scheduling Configuration
    MAX_OPTIMIZATION_TIME_SECONDS: int = 30
    DEFAULT_MIN_STAFF_PER_SHIFT: int = 1
    DEFAULT_MAX_STAFF_PER_SHIFT: int = 10
    MIN_REST_HOURS_BETWEEN_SHIFTS: int = 8
    
    # Feature Flags
    ENABLE_SWAGGER_UI: bool = True
    ENABLE_NEURAL_LEARNING: bool = False
    ENABLE_ADVANCED_ANALYTICS: bool = True
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Parse CORS origins from comma-separated string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def build_database_url(cls, v: str) -> str:
        """Build database URL from components if needed."""
        if v and v.startswith("postgresql://"):
            return v
        
        # Build from components if available
        db_user = os.getenv("DB_USER", "scheduleuser")
        db_password = os.getenv("DB_PASSWORD", "changeme")
        db_host = os.getenv("DB_HOST", "localhost")
        db_port = os.getenv("DB_PORT", "5432")
        db_name = os.getenv("DB_NAME", "scheduledb")
        
        return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    
    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def build_redis_url(cls, v: str) -> str:
        """Build Redis URL with password if needed."""
        if v and v.startswith("redis://"):
            redis_password = os.getenv("REDIS_PASSWORD")
            if redis_password and ":@" not in v:
                # Insert password into URL
                parts = v.replace("redis://", "").split("@")
                if len(parts) == 1:
                    # No auth in URL
                    return f"redis://:{redis_password}@{parts[0]}"
            return v
        
        # Build from components
        redis_host = os.getenv("REDIS_HOST", "localhost")
        redis_port = os.getenv("REDIS_PORT", "6379")
        redis_password = os.getenv("REDIS_PASSWORD", "")
        redis_db = os.getenv("REDIS_DB", "0")
        
        if redis_password:
            return f"redis://:{redis_password}@{redis_host}:{redis_port}/{redis_db}"
        return f"redis://{redis_host}:{redis_port}/{redis_db}"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT.lower() == "development"
    
    @property
    def is_testing(self) -> bool:
        """Check if running in test environment."""
        return self.ENVIRONMENT.lower() in ["test", "testing"]
    
    class Config:
        """Pydantic config."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        
        # Allow extra fields for forward compatibility
        extra = "allow"


# Create global settings instance
settings = Settings()


# Validate critical settings on startup
def validate_settings():
    """Validate critical settings and warn about insecure defaults."""
    warnings = []
    
    if settings.SECRET_KEY == "your-secret-key-change-in-production":
        warnings.append("WARNING: Using default SECRET_KEY. Change this in production!")
    
    if settings.is_production:
        if settings.DEBUG:
            warnings.append("WARNING: DEBUG mode is enabled in production!")
        
        if "localhost" in settings.DATABASE_URL:
            warnings.append("WARNING: Using localhost database in production!")
        
        if not settings.SENTRY_DSN:
            warnings.append("INFO: Sentry error tracking is not configured")
    
    if settings.DATABASE_URL and "changeme" in settings.DATABASE_URL:
        warnings.append("WARNING: Using default database password. Change this immediately!")
    
    if settings.REDIS_URL and "changeme" in settings.REDIS_URL:
        warnings.append("WARNING: Using default Redis password. Change this immediately!")
    
    for warning in warnings:
        print(f"[CONFIG] {warning}")
    
    return len([w for w in warnings if w.startswith("WARNING:")]) == 0


# Run validation on import
validate_settings()