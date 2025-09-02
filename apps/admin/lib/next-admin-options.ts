import { NextAdminOptions } from "@premieroctet/next-admin";
import { prisma } from "@elevate/db";
import { SubmissionStatus, Visibility, LedgerSource } from "@prisma/client";

export const options: NextAdminOptions = {
  title: "MS Elevate LEAPS Admin",
  model: {
    User: {
      toString: (user) => user.name || user.email || "User",
      list: {
        display: ["handle", "name", "email", "role", "school", "cohort", "created_at"],
        search: ["email", "name", "handle", "school", "cohort"],
      },
      edit: {
        display: [
          "id",
          "handle",
          "name",
          "email",
          "avatar_url",
          "role",
          "school", 
          "cohort",
          "kajabi_contact_id",
          "created_at",
        ],
        fields: {
          id: { 
            disabled: true,
          },
          handle: { 
            required: true,
            helperText: "Unique identifier for public profile URLs",
          },
          name: { 
            required: true,
          },
          email: { 
            required: true,
            format: "email",
          },
          role: {
            helperText: "User role determines access permissions",
          },
          avatar_url: {
            helperText: "Profile picture URL",
          },
          school: {
            helperText: "Educational institution",
          },
          cohort: {
            helperText: "Training cohort identifier",
          },
          kajabi_contact_id: {
            helperText: "Linked Kajabi contact for auto-credit",
          },
          created_at: { 
            disabled: true,
            format: "date-time",
          },
        },
      },
    },
    
    Activity: {
      toString: (activity) => activity.name,
      list: {
        display: ["code", "name", "default_points"],
        search: ["name", "code"],
      },
      edit: {
        display: ["code", "name", "default_points"],
        fields: {
          code: {
            required: true,
            helperText: "Activity identifier (LEARN, EXPLORE, etc.)",
          },
          name: {
            required: true,
            helperText: "Display name for the activity",
          },
          default_points: {
            required: true,
            helperText: "Default points awarded for completion",
          },
        },
      },
    },

    Submission: {
      toString: (submission) => `${submission.activity_code} - ${submission.user?.handle || submission.user_id}`,
      list: {
        display: [
          "id",
          "user",
          "activity_code",
          "status",
          "visibility", 
          "reviewer_id",
          "created_at",
          "updated_at",
        ],
        search: ["user.name", "user.email", "user.handle"],
      },
      edit: {
        display: [
          "id",
          "user_id",
          "activity_code",
          "status",
          "visibility",
          "payload",
          "attachments", 
          "reviewer_id",
          "review_note",
          "created_at",
          "updated_at",
        ],
        fields: {
          id: { disabled: true },
          payload: {
            format: "json",
            helperText: "Submission data (JSON format)",
          },
          attachments: {
            format: "json",
            helperText: "File paths array (JSON format)",
          },
          reviewer_id: {
            helperText: "ID of reviewing user",
          },
          review_note: {
            format: "textarea",
            helperText: "Review comments and feedback",
          },
          created_at: { disabled: true, format: "date-time" },
          updated_at: { disabled: true, format: "date-time" },
        },
      },
    },

    PointsLedger: {
      toString: (entry) => `${entry.user?.handle || entry.user_id} - ${entry.delta_points} points`,
      list: {
        display: [
          "id",
          "user",
          "activity_code",
          "delta_points",
          "source",
          "external_source",
          "created_at",
        ],
        search: ["user.name", "user.email", "user.handle"],
      },
      edit: {
        display: [
          "id",
          "user_id",
          "activity_code",
          "delta_points",
          "source",
          "external_source",
          "external_event_id",
          "created_at",
        ],
        fields: {
          id: { disabled: true },
          delta_points: {
            required: true,
            helperText: "Points change (positive or negative)",
          },
          external_source: {
            helperText: "Source system identifier (e.g., 'kajabi')",
          },
          external_event_id: {
            helperText: "Unique event ID for idempotency",
          },
          created_at: { disabled: true, format: "date-time" },
        },
      },
    },

    Badge: {
      toString: (badge) => badge.name,
      list: {
        display: ["code", "name", "description", "icon_url"],
        search: ["name", "code", "description"],
      },
      edit: {
        display: ["code", "name", "description", "criteria", "icon_url"],
        fields: {
          code: {
            required: true,
            helperText: "Unique badge identifier",
          },
          name: {
            required: true,
            helperText: "Display name for the badge",
          },
          description: {
            format: "textarea",
            required: true,
            helperText: "Badge description and requirements",
          },
          criteria: {
            format: "json",
            helperText: "Badge criteria configuration (JSON format)",
          },
          icon_url: {
            helperText: "Badge icon/image URL",
          },
        },
      },
    },

    EarnedBadge: {
      toString: (earned) => `${earned.user?.handle || earned.user_id} - ${earned.badge?.name || earned.badge_code}`,
      list: {
        display: ["id", "user", "badge", "earned_at"],
        search: ["user.name", "user.email", "user.handle", "badge.name"],
      },
      edit: {
        display: ["id", "user_id", "badge_code", "earned_at"],
        fields: {
          id: { disabled: true },
          earned_at: { disabled: true, format: "date-time" },
        },
      },
    },

    KajabiEvent: {
      toString: (event) => `${event.id} - ${event.user_match || 'Unmatched'}`,
      list: {
        display: ["id", "user_match", "processed_at", "received_at"],
        search: ["user_match", "id"],
      },
      edit: {
        display: ["id", "payload", "processed_at", "user_match", "received_at"],
        fields: {
          id: { disabled: true },
          payload: {
            format: "json",
            disabled: true,
            helperText: "Original webhook payload (read-only)",
          },
          processed_at: {
            disabled: true,
            format: "date-time",
            helperText: "When the event was processed",
          },
          user_match: {
            disabled: true,
            helperText: "Matched user email",
          },
          received_at: {
            disabled: true,
            format: "date-time",
            helperText: "When the webhook was received",
          },
        },
      },
    },

    AuditLog: {
      toString: (log) => `${log.action} by ${log.actor_id}`,
      list: {
        display: ["id", "actor_id", "action", "target_id", "created_at"],
        search: ["actor_id", "action", "target_id"],
      },
      edit: {
        display: ["id", "actor_id", "action", "target_id", "meta", "created_at"],
        fields: {
          id: { disabled: true },
          actor_id: {
            disabled: true,
            helperText: "ID of the user who performed the action",
          },
          action: {
            disabled: true,
            helperText: "Action that was performed",
          },
          target_id: {
            disabled: true,
            helperText: "ID of the target resource",
          },
          meta: {
            format: "json",
            disabled: true,
            helperText: "Additional action metadata (read-only)",
          },
          created_at: { disabled: true, format: "date-time" },
        },
      },
    },
  },
  
  sidebar: {
    groups: [
      {
        title: "User Management",
        models: ["User", "Badge", "EarnedBadge"],
      },
      {
        title: "LEAPS Submissions",
        models: ["Submission", "Activity"],
      },
      {
        title: "Points & Tracking",
        models: ["PointsLedger", "KajabiEvent"],
      },
      {
        title: "System Administration",
        models: ["AuditLog"],
      },
    ],
  },
};

export { prisma };