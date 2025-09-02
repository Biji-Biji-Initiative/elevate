import { NextAdminOptions } from "@premieroctet/next-admin";
import { prisma } from "@elevate/db";

export const options: NextAdminOptions = {
  title: "MS Elevate LEAPS Admin",
  model: {
    User: {
      toString: (user) => user.name || user.email || "User",
      list: {
        display: ["handle", "name", "email", "role", "school", "cohort", "created_at"],
        search: ["email", "name", "handle", "school", "cohort"],
        filters: [
          {
            name: "role",
            enum: ["PARTICIPANT", "REVIEWER", "ADMIN", "SUPERADMIN"],
          },
          {
            name: "cohort",
          },
        ],
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
            format: "text",
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
            format: "select",
            enum: ["PARTICIPANT", "REVIEWER", "ADMIN", "SUPERADMIN"],
            helperText: "User role determines access permissions",
          },
          avatar_url: {
            format: "text",
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
            format: "datetime-local",
          },
        },
      },
    },
    
    Activity: {
      toString: (activity) => activity.name,
      list: {
        display: ["code", "name", "default_points"],
        search: ["name", "code"],
        sort: {
          field: "code",
          direction: "asc",
        },
      },
      edit: {
        display: ["code", "name", "default_points"],
        fields: {
          code: {
            validation: { required: true },
            helperText: "Activity identifier (LEARN, EXPLORE, etc.)",
          },
          name: {
            validation: { required: true },
            helperText: "Display name for the activity",
          },
          default_points: {
            type: "number",
            validation: { required: true, min: 0 },
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
        filters: [
          {
            name: "status",
            type: "select",
            options: [
              { label: "Pending", value: "PENDING" },
              { label: "Approved", value: "APPROVED" },
              { label: "Rejected", value: "REJECTED" },
            ],
          },
          {
            name: "activity_code",
            type: "select",
            options: [
              { label: "Learn", value: "LEARN" },
              { label: "Explore", value: "EXPLORE" },
              { label: "Amplify", value: "AMPLIFY" },
              { label: "Present", value: "PRESENT" },
              { label: "Shine", value: "SHINE" },
            ],
          },
          {
            name: "visibility",
            type: "select",
            options: [
              { label: "Public", value: "PUBLIC" },
              { label: "Private", value: "PRIVATE" },
            ],
          },
        ],
        sort: {
          field: "created_at",
          direction: "desc",
        },
        pagination: {
          itemsPerPage: 25,
        },
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
          user_id: { 
            type: "relationship",
            relationName: "user",
          },
          activity_code: {
            type: "relationship",
            relationName: "activity",
          },
          status: {
            type: "select",
            options: [
              { label: "Pending", value: "PENDING" },
              { label: "Approved", value: "APPROVED" },
              { label: "Rejected", value: "REJECTED" },
            ],
          },
          visibility: {
            type: "select",
            options: [
              { label: "Public", value: "PUBLIC" },
              { label: "Private", value: "PRIVATE" },
            ],
          },
          payload: {
            type: "json",
            helperText: "Submission data (JSON format)",
          },
          attachments: {
            type: "json",
            helperText: "File paths array (JSON format)",
          },
          reviewer_id: {
            helperText: "ID of reviewing user",
          },
          review_note: {
            type: "textarea",
            helperText: "Review comments and feedback",
          },
          created_at: { disabled: true },
          updated_at: { disabled: true },
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
        filters: [
          {
            name: "activity_code",
            type: "select",
            options: [
              { label: "Learn", value: "LEARN" },
              { label: "Explore", value: "EXPLORE" },
              { label: "Amplify", value: "AMPLIFY" },
              { label: "Present", value: "PRESENT" },
              { label: "Shine", value: "SHINE" },
            ],
          },
          {
            name: "source",
            type: "select",
            options: [
              { label: "Manual", value: "MANUAL" },
              { label: "Webhook", value: "WEBHOOK" },
              { label: "Form", value: "FORM" },
            ],
          },
        ],
        sort: {
          field: "created_at",
          direction: "desc",
        },
        pagination: {
          itemsPerPage: 100,
        },
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
          user_id: {
            type: "relationship",
            relationName: "user",
          },
          activity_code: {
            type: "relationship",
            relationName: "activity",
          },
          delta_points: {
            type: "number",
            validation: { required: true },
            helperText: "Points change (positive or negative)",
          },
          source: {
            type: "select",
            options: [
              { label: "Manual", value: "MANUAL" },
              { label: "Webhook", value: "WEBHOOK" },
              { label: "Form", value: "FORM" },
            ],
          },
          external_source: {
            helperText: "Source system identifier (e.g., 'kajabi')",
          },
          external_event_id: {
            helperText: "Unique event ID for idempotency",
          },
          created_at: { disabled: true },
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
            validation: { required: true },
            helperText: "Unique badge identifier",
          },
          name: {
            validation: { required: true },
            helperText: "Display name for the badge",
          },
          description: {
            type: "textarea",
            validation: { required: true },
            helperText: "Badge description and requirements",
          },
          criteria: {
            type: "json",
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
        filters: [
          {
            name: "badge_code",
            type: "select",
          },
        ],
        sort: {
          field: "earned_at",
          direction: "desc",
        },
      },
      edit: {
        display: ["id", "user_id", "badge_code", "earned_at"],
        fields: {
          id: { disabled: true },
          user_id: {
            type: "relationship",
            relationName: "user",
          },
          badge_code: {
            type: "relationship",
            relationName: "badge",
          },
          earned_at: { disabled: true },
        },
      },
    },

    KajabiEvent: {
      toString: (event) => `${event.id} - ${event.user_match || 'Unmatched'}`,
      list: {
        display: ["id", "user_match", "processed_at", "received_at"],
        search: ["user_match", "id"],
        filters: [
          {
            name: "processed_at",
            type: "boolean",
            label: "Processed",
          },
        ],
        sort: {
          field: "received_at",
          direction: "desc",
        },
        pagination: {
          itemsPerPage: 25,
        },
      },
      edit: {
        display: ["id", "payload", "processed_at", "user_match", "received_at"],
        fields: {
          id: { disabled: true },
          payload: {
            type: "json",
            disabled: true,
            helperText: "Original webhook payload (read-only)",
          },
          processed_at: {
            disabled: true,
            helperText: "When the event was processed",
          },
          user_match: {
            disabled: true,
            helperText: "Matched user email",
          },
          received_at: {
            disabled: true,
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
        filters: [
          {
            name: "action",
            type: "select",
          },
        ],
        sort: {
          field: "created_at",
          direction: "desc",
        },
        pagination: {
          itemsPerPage: 100,
        },
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
            type: "json",
            disabled: true,
            helperText: "Additional action metadata (read-only)",
          },
          created_at: { disabled: true },
        },
      },
    },
  },
  
  pages: {
    "/api/admin": {
      title: "Dashboard",
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