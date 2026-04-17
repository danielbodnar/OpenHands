"""Analytics router for client-side event tracking.

Provides a single endpoint for the frontend to fire analytics events
server-side, ensuring consent is checked and events go through the
centralized AnalyticsService.
"""

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from openhands.analytics import get_analytics_service, resolve_context
from openhands.app_server.utils.dependencies import get_dependencies
from openhands.core.logger import openhands_logger as logger
from openhands.server.user_auth import get_user_id

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
    dependencies=get_dependencies(),
)


class TrackEventRequest(BaseModel):
    """Request model for generic client-side event tracking."""

    event: str = Field(..., description="Event name (e.g., 'saas_selfhosted_inquiry')")
    properties: dict[str, Any] = Field(
        default_factory=dict,
        description="Event properties",
    )


class TrackEventResponse(BaseModel):
    """Response model for track endpoint."""

    status: str


@router.post("/track", response_model=TrackEventResponse)
async def track_event(
    request: TrackEventRequest,
    user_id: str | None = Depends(get_user_id),
) -> TrackEventResponse:
    """Track a client-side event server-side.

    For authenticated users: uses user_id and fetches consent from DB.
    For anonymous users: uses 'anonymous' distinct_id with consented=False.
    """
    analytics = get_analytics_service()
    if not analytics:
        return TrackEventResponse(status="analytics_disabled")

    if user_id:
        try:
            ctx = await resolve_context(user_id)
            distinct_id = user_id
            consented = ctx.consented
            org_id = ctx.org_id
        except Exception:
            logger.warning("analytics:track:resolve_context_failed user_id=%s", user_id)
            distinct_id = user_id
            consented = False
            org_id = None
    else:
        distinct_id = "anonymous"
        consented = False
        org_id = None

    try:
        analytics.capture(
            distinct_id=distinct_id,
            event=request.event,
            properties=request.properties,
            org_id=org_id,
            consented=consented,
        )
        return TrackEventResponse(status="tracked")
    except Exception:
        logger.exception("analytics:track:capture_failed event=%s", request.event)
        return TrackEventResponse(status="error")
