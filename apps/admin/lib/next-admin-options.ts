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
            validate: (value) => {
              if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                return "Handle can only contain letters, numbers, hyphens, and underscores";
              }
              if (value.length < 3 || value.length > 30) {
                return "Handle must be between 3 and 30 characters";
              }
              return true;
            },
          },
          name: { 
            required: true,
            validate: (value) => {
              if (value.length < 2 || value.length > 100) {
                return "Name must be between 2 and 100 characters";
              }
              return true;
            },
          },
          email: { 
            required: true,
            format: "email",
            validate: (value) => {
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(value)) {
                return "Please enter a valid email address";
              }
              return true;
            },
          },
          role: {
            helperText: "User role determines access permissions",
            validate: (value) => {
              const validRoles = ["PARTICIPANT", "REVIEWER", "ADMIN", "SUPERADMIN"];
              if (!validRoles.includes(value)) {
                return "Invalid role selected";
              }
              return true;
            },
          },
          avatar_url: {
            helperText: "Profile picture URL",
            validate: (value) => {
              if (value && !/^https?:\/\/.+/.test(value)) {
                return "Avatar URL must start with http:// or https://";
              }
              return true;
            },
          },
          school: {
            helperText: "Educational institution",
            validate: (value) => {
              if (value && value.length > 200) {
                return "School name must be less than 200 characters";
              }
              return true;
            },
          },
          cohort: {
            helperText: "Training cohort identifier",
            validate: (value) => {
              if (value && value.length > 50) {
                return "Cohort name must be less than 50 characters";
              }
              return true;
            },
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
            validate: (value) => {
              const validCodes = ["LEARN", "EXPLORE", "AMPLIFY", "PRESENT", "SHINE"];
              if (!validCodes.includes(value)) {
                return "Code must be one of: " + validCodes.join(", ");
              }
              return true;
            },
          },
          name: {
            required: true,
            helperText: "Display name for the activity",
            validate: (value) => {
              if (value.length < 2 || value.length > 50) {
                return "Activity name must be between 2 and 50 characters";
              }
              return true;
            },
          },
          default_points: {
            required: true,
            helperText: "Default points awarded for completion",
            validate: (value) => {
              const points = typeof value === 'number' ? value : parseInt(String(value));
              if (isNaN(points) || points < 0 || points > 1000) {
                return "Points must be a number between 0 and 1000";
              }
              return true;
            },
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
          user_id: {
            helperText: "User who submitted this",
            validate: (value) => {
              if (!value || value.length === 0) {
                return "User ID is required";
              }
              return true;
            },
          },
          activity_code: {
            helperText: "LEAPS activity stage",
            validate: (value) => {
              const validCodes = ["LEARN", "EXPLORE", "AMPLIFY", "PRESENT", "SHINE"];
              if (!validCodes.includes(value)) {
                return "Activity code must be one of: " + validCodes.join(", ");
              }
              return true;
            },
          },
          status: {
            helperText: "Review status",
            validate: (value) => {
              const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
              if (!validStatuses.includes(value)) {
                return "Status must be one of: " + validStatuses.join(", ");
              }
              return true;
            },
          },
          visibility: {
            helperText: "Public or private visibility",
            validate: (value) => {
              const validVisibilities = ["PUBLIC", "PRIVATE"];
              if (!validVisibilities.includes(value)) {
                return "Visibility must be either PUBLIC or PRIVATE";
              }
              return true;
            },
          },
          payload: {
            format: "json",
            helperText: "Submission data (JSON format)",
            validate: (value) => {
              try {
                if (typeof value === 'string') {
                  JSON.parse(value);
                }
                return true;
              } catch {
                return "Payload must be valid JSON";
              }
            },
          },
          attachments: {
            format: "json",
            helperText: "File paths array (JSON format)",
            validate: (value) => {
              try {
                if (typeof value === 'string') {
                  const parsed = JSON.parse(value);
                  if (!Array.isArray(parsed)) {
                    return "Attachments must be a JSON array";
                  }
                }
                return true;
              } catch {
                return "Attachments must be valid JSON array";
              }
            },
          },
          reviewer_id: {
            helperText: "ID of reviewing user",
          },
          review_note: {
            format: "textarea",
            helperText: "Review comments and feedback",
            validate: (value) => {
              if (value && value.length > 1000) {
                return "Review note must be less than 1000 characters";
              }
              return true;
            },
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
          user_id: {
            helperText: "User receiving the points",
            validate: (value) => {
              if (!value || value.length === 0) {
                return "User ID is required";
              }
              return true;
            },
          },
          activity_code: {
            helperText: "Related LEAPS activity",
            validate: (value) => {
              const validCodes = ["LEARN", "EXPLORE", "AMPLIFY", "PRESENT", "SHINE"];
              if (!validCodes.includes(value)) {
                return "Activity code must be one of: " + validCodes.join(", ");
              }
              return true;
            },
          },
          delta_points: {
            required: true,
            helperText: "Points change (positive or negative)",
            validate: (value) => {
              const points = typeof value === 'number' ? value : parseInt(String(value));
              if (isNaN(points) || points < -1000 || points > 1000) {
                return "Delta points must be between -1000 and 1000";
              }
              return true;
            },
          },
          source: {
            helperText: "How these points were awarded",
            validate: (value) => {
              const validSources = ["MANUAL", "WEBHOOK", "FORM"];
              if (!validSources.includes(value)) {
                return "Source must be one of: " + validSources.join(", ");
              }
              return true;
            },
          },
          external_source: {
            helperText: "Source system identifier (e.g., 'kajabi')",
            validate: (value) => {
              if (value && value.length > 50) {
                return "External source must be less than 50 characters";
              }
              return true;
            },
          },
          external_event_id: {
            helperText: "Unique event ID for idempotency",
            validate: (value) => {
              if (value && value.length > 100) {
                return "External event ID must be less than 100 characters";
              }
              return true;
            },
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
            validate: (value) => {
              if (!/^[A-Z_]+$/.test(value)) {
                return "Badge code must contain only uppercase letters and underscores";
              }
              if (value.length < 2 || value.length > 50) {
                return "Badge code must be between 2 and 50 characters";
              }
              return true;
            },
          },
          name: {
            required: true,
            helperText: "Display name for the badge",
            validate: (value) => {
              if (value.length < 2 || value.length > 100) {
                return "Badge name must be between 2 and 100 characters";
              }
              return true;
            },
          },
          description: {
            format: "textarea",
            required: true,
            helperText: "Badge description and requirements",
            validate: (value) => {
              if (value.length < 10 || value.length > 500) {
                return "Badge description must be between 10 and 500 characters";
              }
              return true;
            },
          },
          criteria: {
            format: "json",
            helperText: "Badge criteria configuration (JSON format)",
            validate: (value) => {
              try {
                if (typeof value === 'string') {
                  JSON.parse(value);
                }
                return true;
              } catch {
                return "Criteria must be valid JSON";
              }
            },
          },
          icon_url: {
            helperText: "Badge icon/image URL",
            validate: (value) => {
              if (value && !/^https?:\/\/.+/.test(value)) {
                return "Icon URL must start with http:// or https://";
              }
              return true;
            },
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