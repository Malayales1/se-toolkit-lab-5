"""Router for analytics endpoints.

Each endpoint performs SQL aggregation queries on the interaction data
populated by the ETL pipeline. All endpoints require a `lab` query
parameter to filter results by lab (e.g., "lab-01").
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.database import get_session
from app.models.item import ItemRecord
from app.models.interaction import InteractionLog

router = APIRouter()


@router.get("/scores")
async def get_scores(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Score distribution histogram for a given lab.

    - Find the lab item by matching title (e.g. "lab-04" → title contains "Lab 04")
    - Find all tasks that belong to this lab (parent_id = lab.id)
    - Query interactions for these items that have a score
    - Group scores into buckets: "0-25", "26-50", "51-75", "76-100"
      using CASE WHEN expressions
    - Return a JSON array:
      [{"bucket": "0-25", "count": 12}, {"bucket": "26-50", "count": 8}, ...]
    - Always return all four buckets, even if count is 0
    """
    # Находим lab по title (например, "lab-04" → "Lab 04")
    lab_title = lab.replace("-", " ").title()
    lab_result = (
        await session.execute(
            select(ItemRecord).where(
                ItemRecord.type == "lab",
                func.lower(ItemRecord.title).like(f"%{lab.replace('-', ' ')}%")
            )
        )
    ).scalar_one_or_none()

    if not lab_result:
        return [
            {"bucket": "0-25", "count": 0},
            {"bucket": "26-50", "count": 0},
            {"bucket": "51-75", "count": 0},
            {"bucket": "76-100", "count": 0},
        ]

    # Находим все task этого lab
    tasks_result = await session.execute(
        select(ItemRecord.id).where(ItemRecord.parent_id == lab_result.id)
    )
    task_ids = [row[0] for row in tasks_result.all()]

    if not task_ids:
        return [
            {"bucket": "0-25", "count": 0},
            {"bucket": "26-50", "count": 0},
            {"bucket": "51-75", "count": 0},
            {"bucket": "76-100", "count": 0},
        ]

    # Запрашиваем взаимодействия с score для этих task
    stmt = (
        select(
            case(
                (InteractionLog.score <= 25, "0-25"),
                (InteractionLog.score <= 50, "26-50"),
                (InteractionLog.score <= 75, "51-75"),
                else_="76-100",
            ).label("bucket"),
            func.count().label("count"),
        )
        .where(InteractionLog.item_id.in_(task_ids))
        .where(InteractionLog.score.isnot(None))
        .group_by("bucket")
    )

    result = await session.execute(stmt)
    bucket_counts = {row.bucket: row.count for row in result.all()}

    # Возвращаем все 4 бакета, даже если count = 0
    return [
        {"bucket": "0-25", "count": bucket_counts.get("0-25", 0)},
        {"bucket": "26-50", "count": bucket_counts.get("26-50", 0)},
        {"bucket": "51-75", "count": bucket_counts.get("51-75", 0)},
        {"bucket": "76-100", "count": bucket_counts.get("76-100", 0)},
    ]


@router.get("/pass-rates")
async def get_pass_rates(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Per-task pass rates for a given lab."""
    # Находим lab по title
    lab_result = (
        await session.execute(
            select(ItemRecord).where(
                ItemRecord.type == "lab",
                func.lower(ItemRecord.title).like(f"%{lab.replace('-', ' ')}%")
            )
        )
    ).scalar_one_or_none()

    if not lab_result:
        return []

    # Находим все task этого lab
    tasks_result = await session.execute(
        select(ItemRecord).where(ItemRecord.parent_id == lab_result.id).order_by(ItemRecord.title)
    )
    tasks = tasks_result.scalars().all()

    result = []
    for task in tasks:
        # Запрашиваем агрегацию по task
        stmt = (
            select(
                func.avg(InteractionLog.score).label("avg_score"),
                func.count().label("attempts"),
            )
            .where(InteractionLog.item_id == task.id)
            .where(InteractionLog.score.isnot(None))
        )
        agg_result = await session.execute(stmt)
        row = agg_result.one()

        avg_score = round(row.avg_score, 1) if row.avg_score is not None else 0.0
        result.append({
            "task": task.title,
            "avg_score": avg_score,
            "attempts": row.attempts,
        })

    return result


@router.get("/timeline")
async def get_timeline(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Submissions per day for a given lab."""
    # Находим lab по title
    lab_result = (
        await session.execute(
            select(ItemRecord).where(
                ItemRecord.type == "lab",
                func.lower(ItemRecord.title).like(f"%{lab.replace('-', ' ')}%")
            )
        )
    ).scalar_one_or_none()

    if not lab_result:
        return []

    # Находим все task этого lab
    tasks_result = await session.execute(
        select(ItemRecord.id).where(ItemRecord.parent_id == lab_result.id)
    )
    task_ids = [row[0] for row in tasks_result.all()]

    if not task_ids:
        return []

    # Группируем взаимодействия по дате
    stmt = (
        select(
            func.date(InteractionLog.created_at).label("date"),
            func.count().label("submissions"),
        )
        .where(InteractionLog.item_id.in_(task_ids))
        .group_by(func.date(InteractionLog.created_at))
        .order_by(func.date(InteractionLog.created_at))
    )

    result = await session.execute(stmt)
    return [
        {"date": row.date, "submissions": row.submissions}
        for row in result.all()
    ]


@router.get("/groups")
async def get_groups(
    lab: str = Query(..., description="Lab identifier, e.g. 'lab-01'"),
    session: AsyncSession = Depends(get_session),
):
    """Per-group performance for a given lab."""
    from app.models.learner import Learner

    # Находим lab по title
    lab_result = (
        await session.execute(
            select(ItemRecord).where(
                ItemRecord.type == "lab",
                func.lower(ItemRecord.title).like(f"%{lab.replace('-', ' ')}%")
            )
        )
    ).scalar_one_or_none()

    if not lab_result:
        return []

    # Находим все task этого lab
    tasks_result = await session.execute(
        select(ItemRecord.id).where(ItemRecord.parent_id == lab_result.id)
    )
    task_ids = [row[0] for row in tasks_result.all()]

    if not task_ids:
        return []

    # JOIN interactions с learners для получения student_group
    stmt = (
        select(
            Learner.student_group.label("group"),
            func.avg(InteractionLog.score).label("avg_score"),
            func.count(Learner.id.distinct()).label("students"),
        )
        .join(InteractionLog, InteractionLog.learner_id == Learner.id)
        .where(InteractionLog.item_id.in_(task_ids))
        .where(InteractionLog.score.isnot(None))
        .group_by(Learner.student_group)
        .order_by(Learner.student_group)
    )

    result = await session.execute(stmt)
    return [
        {
            "group": row.group,
            "avg_score": round(row.avg_score, 1) if row.avg_score is not None else 0.0,
            "students": row.students,
        }
        for row in result.all()
    ]
