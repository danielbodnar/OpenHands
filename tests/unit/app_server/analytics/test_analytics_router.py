"""Tests for the analytics API endpoint."""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from openhands.app_server.analytics.analytics_router import router as analytics_router


@pytest.fixture
def test_client():
    """Create a test client for the analytics API."""
    app = FastAPI()
    app.include_router(analytics_router)

    # Mock SESSION_API_KEY to None to disable authentication in tests
    with patch.dict(os.environ, {"SESSION_API_KEY": ""}, clear=False):
        with patch("openhands.app_server.utils.dependencies._SESSION_API_KEY", None):
            yield TestClient(app)


@pytest.fixture
def mock_analytics_service():
    """Create a mock analytics service."""
    mock_service = MagicMock()
    mock_service.capture = MagicMock()
    return mock_service


class TestTrackEventEndpoint:
    """Tests for POST /analytics/track endpoint."""

    def test_track_event_analytics_disabled(self, test_client):
        """Test tracking when analytics service is disabled."""
        with patch(
            "openhands.app_server.analytics.analytics_router.get_analytics_service",
            return_value=None,
        ):
            response = test_client.post(
                "/analytics/track",
                json={"event": "test_event", "properties": {"key": "value"}},
            )

        assert response.status_code == 200
        assert response.json() == {"status": "analytics_disabled"}

    def test_track_event_anonymous_user(self, test_client, mock_analytics_service):
        """Test tracking for anonymous (unauthenticated) user."""
        with patch(
            "openhands.app_server.analytics.analytics_router.get_analytics_service",
            return_value=mock_analytics_service,
        ):
            with patch(
                "openhands.app_server.analytics.analytics_router.get_user_id",
                return_value=None,
            ):
                response = test_client.post(
                    "/analytics/track",
                    json={
                        "event": "saas_selfhosted_inquiry",
                        "properties": {"location": "home_page"},
                    },
                )

        assert response.status_code == 200
        assert response.json() == {"status": "tracked"}
        mock_analytics_service.capture.assert_called_once_with(
            distinct_id="anonymous",
            event="saas_selfhosted_inquiry",
            properties={"location": "home_page"},
            org_id=None,
            consented=False,
        )

    def test_track_event_authenticated_user_consented(
        self, test_client, mock_analytics_service
    ):
        """Test tracking for authenticated user who has consented."""
        mock_context = MagicMock()
        mock_context.consented = True
        mock_context.org_id = "org-123"

        with patch(
            "openhands.app_server.analytics.analytics_router.get_analytics_service",
            return_value=mock_analytics_service,
        ):
            with patch(
                "openhands.server.user_auth.get_user_id",
                return_value=AsyncMock(return_value="user-456"),
            ):
                with patch(
                    "openhands.app_server.analytics.analytics_router.resolve_context",
                    return_value=mock_context,
                ):
                    # Need to override the dependency
                    from openhands.app_server.analytics import analytics_router

                    async def mock_get_user_id():
                        return "user-456"

                    analytics_router.router.dependency_overrides = {}

                    response = test_client.post(
                        "/analytics/track",
                        json={
                            "event": "enterprise_lead_form_submitted",
                            "properties": {
                                "request_type": "saas",
                                "name": "Test User",
                                "company": "Test Corp",
                                "email": "test@example.com",
                                "message": "Test message",
                            },
                        },
                    )

        assert response.status_code == 200
        assert response.json() == {"status": "tracked"}

    def test_track_event_authenticated_user_not_consented(
        self, test_client, mock_analytics_service
    ):
        """Test tracking for authenticated user who has not consented."""
        mock_context = MagicMock()
        mock_context.consented = False
        mock_context.org_id = None

        with patch(
            "openhands.app_server.analytics.analytics_router.get_analytics_service",
            return_value=mock_analytics_service,
        ):
            with patch(
                "openhands.app_server.analytics.analytics_router.resolve_context",
                return_value=mock_context,
            ):
                response = test_client.post(
                    "/analytics/track",
                    json={"event": "test_event", "properties": {}},
                )

        assert response.status_code == 200
        assert response.json() == {"status": "tracked"}

    def test_track_event_capture_exception(self, test_client, mock_analytics_service):
        """Test handling of capture exceptions."""
        mock_analytics_service.capture.side_effect = Exception("PostHog error")

        with patch(
            "openhands.app_server.analytics.analytics_router.get_analytics_service",
            return_value=mock_analytics_service,
        ):
            response = test_client.post(
                "/analytics/track",
                json={"event": "test_event", "properties": {}},
            )

        assert response.status_code == 200
        assert response.json() == {"status": "error"}

    def test_track_event_empty_properties(self, test_client, mock_analytics_service):
        """Test tracking with empty properties."""
        with patch(
            "openhands.app_server.analytics.analytics_router.get_analytics_service",
            return_value=mock_analytics_service,
        ):
            response = test_client.post(
                "/analytics/track",
                json={"event": "button_clicked"},
            )

        assert response.status_code == 200
        assert response.json() == {"status": "tracked"}
        mock_analytics_service.capture.assert_called_once()
        call_kwargs = mock_analytics_service.capture.call_args[1]
        assert call_kwargs["event"] == "button_clicked"
        assert call_kwargs["properties"] == {}

    def test_track_event_missing_event_field(self, test_client):
        """Test that missing event field returns validation error."""
        with patch(
            "openhands.app_server.analytics.analytics_router.get_analytics_service",
            return_value=MagicMock(),
        ):
            response = test_client.post(
                "/analytics/track",
                json={"properties": {"key": "value"}},
            )

        assert response.status_code == 422  # Validation error
