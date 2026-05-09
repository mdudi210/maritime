from fastapi.testclient import TestClient
from uuid import uuid4
from datetime import date, timedelta

from app.main import app


def _csrf(client: TestClient) -> dict[str, str]:
    token = client.cookies.get("csrf_token")
    return {"X-CSRF-Token": token} if token else {}


def test_login_me_refresh_logout_flow():
    with TestClient(app) as client:
        login_response = client.post(
            "/api/auth/login",
            json={"email_or_username": "admin@example.com", "password": "Admin@12345"},
        )
        assert login_response.status_code == 200
        assert login_response.json()["user"]["role"] == "admin"
        assert client.cookies.get("access_token")
        assert client.cookies.get("refresh_token")
        assert client.cookies.get("csrf_token")

        me_response = client.get("/api/users/me")
        assert me_response.status_code == 200
        assert me_response.json()["email"] == "admin@example.com"

        refresh_response = client.post("/api/auth/refresh", headers=_csrf(client))
        assert refresh_response.status_code == 200

        logout_response = client.post("/api/auth/logout", headers=_csrf(client))
        assert logout_response.status_code == 200
        assert not client.cookies.get("access_token")


def test_admin_can_create_list_and_promote_user():
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        login_response = client.post(
            "/api/auth/login",
            json={"email_or_username": "admin@example.com", "password": "Admin@12345"},
        )
        assert login_response.status_code == 200

        create_response = client.post(
            "/api/users",
            headers=_csrf(client),
            json={
                "email": f"crew-{suffix}@example.com",
                "username": f"crew-{suffix}",
                "password": "Crew@12345",
                "role": "crew",
                "ship_id": None,
            },
        )
        assert create_response.status_code == 201
        created = create_response.json()
        assert created["role"] == "crew"
        assert created["is_active"] is True
        assert created["created_at"]

        list_response = client.get("/api/users")
        assert list_response.status_code == 200
        assert any(user["id"] == created["id"] for user in list_response.json())

        promote_response = client.patch(
            f"/api/users/{created['id']}",
            headers=_csrf(client),
            json={"role": "admin", "ship_id": None},
        )
        assert promote_response.status_code == 200
        assert promote_response.json()["role"] == "admin"


def test_new_user_must_reset_password_before_access():
    suffix = uuid4().hex[:8]
    email = f"first-login-{suffix}@example.com"
    username = f"first-login-{suffix}"
    temporary_password = "TempPass123"
    new_password = "PrivatePass123"

    with TestClient(app) as admin_client:
        login_response = admin_client.post(
            "/api/auth/login",
            json={"email_or_username": "admin@example.com", "password": "Admin@12345"},
        )
        assert login_response.status_code == 200
        create_response = admin_client.post(
            "/api/users",
            headers=_csrf(admin_client),
            json={
                "email": email,
                "username": username,
                "password": temporary_password,
                "role": "crew",
                "ship_id": None,
            },
        )
        assert create_response.status_code == 201
        assert create_response.json()["password_reset_required"] is True

    with TestClient(app) as user_client:
        login_response = user_client.post(
            "/api/auth/login",
            json={"email_or_username": email, "password": temporary_password},
        )
        assert login_response.status_code == 200
        assert login_response.json()["user"]["password_reset_required"] is True

        blocked_response = user_client.get("/api/dashboard/compliance")
        assert blocked_response.status_code == 403
        assert blocked_response.json()["detail"] == "Password reset required"

        reset_response = user_client.post(
            "/api/auth/change-password",
            headers=_csrf(user_client),
            json={"current_password": temporary_password, "new_password": new_password},
        )
        assert reset_response.status_code == 200
        assert reset_response.json()["password_reset_required"] is False

        allowed_response = user_client.get("/api/dashboard/compliance")
        assert allowed_response.status_code == 200


def test_admin_can_delete_drill():
    with TestClient(app) as client:
        login_response = client.post(
            "/api/auth/login",
            json={"email_or_username": "admin@example.com", "password": "Admin@12345"},
        )
        assert login_response.status_code == 200

        ships_response = client.get("/api/ships")
        assert ships_response.status_code == 200
        ship_id = ships_response.json()[0]["id"]

        create_response = client.post(
            "/api/drills",
            headers=_csrf(client),
            json={
                "drill_type": f"Delete drill {uuid4().hex[:8]}",
                "ship_id": ship_id,
                "scheduled_date": str(date.today() + timedelta(days=7)),
                "scheduled_time": "10:00",
                "end_time": "10:30",
            },
        )
        assert create_response.status_code == 200
        drill_id = create_response.json()["id"]

        delete_response = client.delete(f"/api/drills/{drill_id}", headers=_csrf(client))
        assert delete_response.status_code == 200
        assert delete_response.json()["message"] == "Drill deleted"

        drills_response = client.get("/api/drills")
        assert drills_response.status_code == 200
        assert all(drill["id"] != drill_id for drill in drills_response.json())


def test_task_completion_and_drill_attendance_timestamps_are_visible():
    with TestClient(app) as admin_client:
        login_response = admin_client.post(
            "/api/auth/login",
            json={"email_or_username": "admin@example.com", "password": "Admin@12345"},
        )
        assert login_response.status_code == 200

        users_response = admin_client.get("/api/users?role=crew")
        assert users_response.status_code == 200
        crew_user = next(user for user in users_response.json() if user["ship_id"])
        ship_id = crew_user["ship_id"]

        task_response = admin_client.post(
            "/api/maintenance",
            headers=_csrf(admin_client),
            json={
                "title": f"Completion task {uuid4().hex[:8]}",
                "ship_id": ship_id,
                "assigned_to_id": crew_user["id"],
                "due_date": str(date.today() + timedelta(days=1)),
                "due_time": "14:30",
            },
        )
        assert task_response.status_code == 200
        task = task_response.json()
        assert task["due_time"] == "14:30:00"

        complete_response = admin_client.patch(
            f"/api/maintenance/{task['id']}",
            headers=_csrf(admin_client),
            json={"status": "completed"},
        )
        assert complete_response.status_code == 200
        completed_task = complete_response.json()
        assert completed_task["completed_at"]
        assert completed_task["completed_by_id"] == 1

        drill_response = admin_client.post(
            "/api/drills",
            headers=_csrf(admin_client),
            json={
                "drill_type": f"Timed drill {uuid4().hex[:8]}",
                "ship_id": ship_id,
                "scheduled_date": str(date.today()),
                "scheduled_time": "00:00",
                "end_time": "23:59",
            },
        )
        assert drill_response.status_code == 200
        drill = drill_response.json()
        assert drill["scheduled_time"] == "00:00:00"
        assert drill["end_time"] == "23:59:00"

    with TestClient(app) as crew_client:
        login_response = crew_client.post(
            "/api/auth/login",
            json={"email_or_username": "crew@example.com", "password": "Crew@12345"},
        )
        assert login_response.status_code == 200

        attendance_response = crew_client.post(
            f"/api/drills/{drill['id']}/attendance/mark",
            headers=_csrf(crew_client),
            json={"attendance": True},
        )
        assert attendance_response.status_code == 200
        assert attendance_response.json()["attended_at"]

        completion_response = crew_client.post(
            f"/api/drills/{drill['id']}/complete",
            headers=_csrf(crew_client),
            json={"completed": True},
        )
        assert completion_response.status_code == 200
        completed_row = completion_response.json()
        assert completed_row["attendance"] is True
        assert completed_row["completed_at"]
