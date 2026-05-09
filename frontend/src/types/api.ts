export type Role = "admin" | "crew";

export type UserSummary = {
  id: number;
  email: string;
  username: string;
  role: Role;
  ship_id: number | null;
  all_ships: boolean;
  is_active: boolean;
  password_reset_required: boolean;
  created_at: string;
  last_login_at: string | null;
  total_drills_assigned: number;
  total_drills_completed: number;
};

export type LoginResponse = {
  message: string;
  user: UserSummary;
};

export type DashboardMetrics = {
  ships: number;
  maintenance_total: number;
  maintenance_completed: number;
  maintenance_overdue: number;
  drills_total: number;
  drills_completed: number;
  drills_missed: number;
  maintenance_compliance_percent: number;
  drill_compliance_percent: number;
  drill_participation_percent: number;
};

export type ComplianceItems = {
  pending_maintenance: MaintenanceTask[];
  overdue_maintenance: MaintenanceTask[];
  missed_drills: SafetyDrill[];
};

export type Ship = {
  id: number;
  name: string;
  imo_number: string | null;
  current_port: string | null;
  status: string;
};

export type MaintenanceTask = {
  id: number;
  title: string;
  description: string | null;
  ship_id: number;
  assigned_to_id: number | null;
  assigned_to_ids: number[];
  status: "pending" | "in_progress" | "completed";
  due_date: string;
  due_time: string | null;
  completed_by_id: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskComment = {
  id: number;
  task_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  user: { id: number; email: string; username: string };
};

export type SafetyDrill = {
  id: number;
  drill_type: string;
  ship_id: number;
  scheduled_date: string;
  scheduled_time: string | null;
  end_time: string | null;
  status: "scheduled" | "active" | "completed" | "missed";
  created_at: string;
};

export type DrillAttendanceEntry = {
  id: number;
  drill_id: number;
  user_id: number;
  attendance: boolean;
  completion_status: string;
  attended_at: string | null;
  completed_at: string | null;
  user: { id: number; email: string; username: string };
};
