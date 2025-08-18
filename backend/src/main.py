from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from src.api import rules, schedule, employees, analytics, auth
from src.core.config import settings
from src.core.database import engine, Base
from src.nlp.rule_parser import RuleParser

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Schedule Manager...")
    Base.metadata.create_all(bind=engine)
    
    logger.info("Loading NLP models...")
    app.state.rule_parser = RuleParser()
    await app.state.rule_parser.initialize()
    
    yield
    
    logger.info("Shutting down AI Schedule Manager...")

app = FastAPI(
    title="AI Schedule Manager",
    description="Neural-powered scheduling for small businesses",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(rules.router, prefix="/api/rules", tags=["rules"])
app.include_router(schedule.router, prefix="/api/schedule", tags=["schedule"])
app.include_router(employees.router, prefix="/api/employees", tags=["employees"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])

@app.get("/")
async def root():
    return {
        "message": "AI Schedule Manager API",
        "version": "0.1.0",
        "status": "operational"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}