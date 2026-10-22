import os
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_DEFAULT_JWT_SECRET = "dev_jwt_secret_change_me_in_production_f7a93c4e12b8"
DEV_DEFAULT_API_KEY_PEPPER = "dev_api_key_pepper_secret_never_share_38c92a11"
DEV_DEFAULT_FERNET_KEY = "dGhpcy1pcy1hLTMyLWJ5dGUtZGV2LWZlcm5ldC1rZXk9PQ=="

class Settings(BaseSettings):
    PROJECT_NAME: str = "AgentShield AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment mode: 'dev' or 'production'
    ENVIRONMENT: str = "dev"
    
    # Database URL
    DATABASE_URL: str = "sqlite+aiosqlite:///./agentshield.db"
    
    # JWT & Refresh Authentication
    JWT_SECRET: str = DEV_DEFAULT_JWT_SECRET
    ALGORITHM: str = "HS256"
    JWT_ACCESS_MINUTES: int = 30
    REFRESH_DAYS: int = 14
    
    # API Key Hashing Pepper
    API_KEY_PEPPER: str = DEV_DEFAULT_API_KEY_PEPPER
    
    # Symmetric Encryption for Secrets at Rest (Fernet key)
    SECRETS_ENCRYPTION_KEY: str = DEV_DEFAULT_FERNET_KEY
    
    # Default Admin Seed Credentials
    ADMIN_EMAIL: str = "admin@agentshield.local"
    ADMIN_PASSWORD: str = "AdminPassword2026!"
    
    # Ingress & Network
    CORS_ORIGINS: List[str] = [
        "http://localhost:8080",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]
    ENABLE_DOCS: bool = True
    PUBLIC_BASE_URL: str = "http://localhost:8080"
    
    # Risk & Evaluation Thresholds
    ALERT_THRESHOLD: float = 60.0
    REVIEW_THRESHOLD: float = 70.0
    BLOCK_THRESHOLD: float = 80.0
    RISK_WEIGHT_RULE: float = 0.4
    RISK_WEIGHT_ANOMALY: float = 0.6
    ANOMALY_HIGH_THRESHOLD: float = 0.70
    
    # Machine Learning Settings
    ML_FEATURE_SET: str = "v1"
    ML_MIN_AGENT_SAMPLES: int = 200
    ML_MIN_ORG_SAMPLES: int = 500
    ML_BOOTSTRAP: bool = True
    MODEL_DIR: str = "./models_data"
    
    # Realtime & Webhook Workers
    EVENT_BUS: str = "memory"  # 'memory' or 'postgres'
    WEB_CONCURRENCY: int = 1
    RUN_WORKER_INLINE: bool = True
    
    # Rate Limits & Overlap
    RATE_LIMIT_PER_KEY_PER_MIN: int = 300
    KEY_ROTATION_GRACE_HOURS: int = 24
    
    # Retention
    RETENTION_DAYS: int = 30
    ALERT_RETENTION_DAYS: int = 365
    
    # Observability & Metrics
    METRICS_TOKEN: str = "agentshield_metrics_internal_token_99"
    LOG_LEVEL: str = "INFO"
    
    # Demo & Simulator Controls
    DEMO_MODE: bool = False
    SIMULATOR_ENABLED: bool = False
    AUTO_SIMULATE: bool = False  # Legacy compat
    SIMULATOR_INTERVAL_SECONDS: float = 3.5
    
    # Frontend Base URL
    VITE_API_BASE: str = "/api"

    # Legacy attribute compatibility
    @property
    def SECRET_KEY(self) -> str:
        return self.JWT_SECRET

    @property
    def ALERT_RISK_THRESHOLD(self) -> float:
        return self.ALERT_THRESHOLD

    @property
    def ANOMALY_THRESHOLD(self) -> float:
        return self.ANOMALY_HIGH_THRESHOLD

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production":
            unsafe_fields = []
            if self.JWT_SECRET == DEV_DEFAULT_JWT_SECRET:
                unsafe_fields.append("JWT_SECRET")
            if self.API_KEY_PEPPER == DEV_DEFAULT_API_KEY_PEPPER:
                unsafe_fields.append("API_KEY_PEPPER")
            if self.SECRETS_ENCRYPTION_KEY == DEV_DEFAULT_FERNET_KEY:
                unsafe_fields.append("SECRETS_ENCRYPTION_KEY")
            
            if unsafe_fields:
                raise ValueError(
                    f"Production startup refused: {', '.join(unsafe_fields)} cannot use dev defaults in production mode."
                )
        return self

settings = Settings()
