"""SQLAlchemy models and DB session for NeuroFlow."""
from datetime import datetime
import json
from sqlalchemy import (
    create_engine, Column, Integer, Float, String, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, scoped_session

Base = declarative_base()


class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    mode = Column(String, nullable=False)  # 'impedance', 'alpha', 'focus'
    duration_sec = Column(Float)
    avg_score = Column(Float)
    peak_score = Column(Float)
    avg_theta_beta = Column(Float)
    time_above_50 = Column(Float)
    time_above_75 = Column(Float)
    trend = Column(String)
    meta = Column("metadata", Text)  # JSON-encoded blob

    samples = relationship(
        "SessionSample", back_populates="session", cascade="all, delete-orphan"
    )
    impedances = relationship(
        "ImpedanceCheck", back_populates="session", cascade="all, delete-orphan"
    )
    alpha = relationship(
        "AlphaTest", back_populates="session", cascade="all, delete-orphan"
    )

    def to_dict(self, include_samples=False):
        d = {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "mode": self.mode,
            "duration_sec": self.duration_sec,
            "avg_score": self.avg_score,
            "peak_score": self.peak_score,
            "avg_theta_beta": self.avg_theta_beta,
            "time_above_50": self.time_above_50,
            "time_above_75": self.time_above_75,
            "trend": self.trend,
            "metadata": json.loads(self.meta) if self.meta else None,
        }
        if include_samples:
            d["samples"] = [s.to_dict() for s in self.samples]
            d["impedances"] = [i.to_dict() for i in self.impedances]
            d["alpha"] = [a.to_dict() for a in self.alpha]
        return d


class SessionSample(Base):
    __tablename__ = "session_samples"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    t = Column(Float)
    delta = Column(Float)
    theta = Column(Float)
    alpha = Column(Float)
    beta = Column(Float)
    gamma = Column(Float)
    theta_beta = Column(Float)
    score = Column(Float)
    channel = Column(String, default="Cz")
    session = relationship("Session", back_populates="samples")

    def to_dict(self):
        return {
            "t": self.t, "delta": self.delta, "theta": self.theta,
            "alpha": self.alpha, "beta": self.beta, "gamma": self.gamma,
            "theta_beta": self.theta_beta, "score": self.score,
            "channel": self.channel,
        }


class ImpedanceCheck(Base):
    __tablename__ = "impedance_checks"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    channel_name = Column(String)
    rms_uv = Column(Float)
    noise_60hz = Column(Float)
    status = Column(String)
    session = relationship("Session", back_populates="impedances")

    def to_dict(self):
        return {
            "channel_name": self.channel_name, "rms_uv": self.rms_uv,
            "noise_60hz": self.noise_60hz, "status": self.status,
        }


class AlphaTest(Base):
    __tablename__ = "alpha_tests"
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    eyes_open_alpha = Column(Float)
    eyes_closed_alpha = Column(Float)
    alpha_ratio = Column(Float)
    result = Column(String)
    session = relationship("Session", back_populates="alpha")

    def to_dict(self):
        return {
            "eyes_open_alpha": self.eyes_open_alpha,
            "eyes_closed_alpha": self.eyes_closed_alpha,
            "alpha_ratio": self.alpha_ratio,
            "result": self.result,
        }


_engine = None
_SessionLocal = None


def init_db(db_path="neuroflow.db"):
    global _engine, _SessionLocal
    _engine = create_engine(f"sqlite:///{db_path}", future=True)
    Base.metadata.create_all(_engine)
    _SessionLocal = scoped_session(
        sessionmaker(bind=_engine, autoflush=False, expire_on_commit=False)
    )
    return _SessionLocal


def get_db():
    if _SessionLocal is None:
        init_db()
    return _SessionLocal()
