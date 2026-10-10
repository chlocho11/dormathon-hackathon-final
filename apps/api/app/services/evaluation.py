"""Persist and read evaluation results (evaluation_runs)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import EvaluationRun

METHOD = "offline_synthetic_v1"


def store_evaluation(session: Session, result: dict, artifact_path: str) -> EvaluationRun:
    ds = result["dataset"]
    run = EvaluationRun(
        workspace_id=None,
        dataset_version=f"{ds['generator_version']}:{ds['start_date']}..{ds['end_date']}",
        seed=ds["seed"],
        method=METHOD,
        metrics_json=result,
        artifact_path=artifact_path,
        data_origin="synthetic",
    )
    session.add(run)
    session.commit()
    return run


def latest_evaluation(session: Session) -> EvaluationRun | None:
    return session.scalar(
        select(EvaluationRun).where(EvaluationRun.method == METHOD).order_by(EvaluationRun.evaluated_at.desc())
    )
