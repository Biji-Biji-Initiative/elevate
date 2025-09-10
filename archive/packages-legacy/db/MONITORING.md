# Database Monitoring Guide

## Overview

This guide provides comprehensive monitoring strategies, alerting configurations, and performance dashboards for the MS Elevate LEAPS Tracker database system. It covers operational metrics, business KPIs, and Indonesian education program-specific monitoring requirements.

## Table of Contents

1. [Monitoring Architecture](#monitoring-architecture)
2. [Key Performance Indicators (KPIs)](#key-performance-indicators-kpis)
3. [Infrastructure Monitoring](#infrastructure-monitoring)
4. [Application-Level Monitoring](#application-level-monitoring)
5. [Business Metrics Monitoring](#business-metrics-monitoring)
6. [Alert Configuration](#alert-configuration)
7. [Dashboard Setup](#dashboard-setup)
8. [Log Analysis](#log-analysis)
9. [Performance Baselines](#performance-baselines)
10. [Monitoring Automation](#monitoring-automation)

## Monitoring Architecture

### Components Stack
```
┌─────────────────────────────────────────┐
│             Alerting Layer              │
│  • PagerDuty / Slack / Email           │
│  • Escalation Policies                 │
│  • Incident Management                 │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│            Visualization                │
│  • Grafana Dashboards                  │
│  • Custom Analytics Views              │
│  • Real-time Metrics                   │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│           Metrics Collection            │
│  • Prometheus / DataDog                │
│  • Custom Metrics API                  │
│  • Database Queries                    │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│              Data Sources               │
│  • Supabase Metrics                    │
│  • Application Logs                    │
│  • PostgreSQL Stats                    │
│  • Business Logic Queries              │
└─────────────────────────────────────────┘
```

### Monitoring Tools Integration

#### Supabase Native Monitoring
- **Database metrics**: CPU, memory, disk usage
- **Connection statistics**: Active connections, pool usage
- **Query performance**: Slow query logs, execution plans
- **Real-time activity**: Current queries, wait events

#### Custom Metrics Collection
```typescript
// /api/metrics/database
export async function GET() {
  const metrics = {
    // Connection health
    connectionStatus: await checkDatabaseConnection(),
    
    // Performance metrics
    slowQueryCount: await getSlowQueryCount(),
    connectionPoolUsage: await getConnectionPoolUsage(),
    
    // Business metrics
    dailySubmissions: await getDailySubmissionCount(),
    pendingReviews: await getPendingReviewCount(),
    
    // System health
    materializeViewFreshness: await getViewFreshness(),
    indexEfficiency: await getIndexUsage(),
  };

  return Response.json(metrics);
}
```

## Key Performance Indicators (KPIs)

### Infrastructure KPIs

#### Database Performance
- **Connection Latency**: < 50ms P95
- **Query Response Time**: < 200ms P95 for dashboard queries
- **Connection Pool Usage**: < 80% utilization
- **Database CPU**: < 70% average
- **Memory Usage**: < 85% of allocated
- **Disk I/O**: < 80% of IOPS limit

#### Materialized View Performance
- **Refresh Duration**: < 2 minutes for all views
- **View Freshness**: < 5 minutes behind real-time
- **Concurrent Refresh Success**: 99%+ success rate
- **View Query Performance**: < 100ms P95

### Business KPIs

#### User Engagement (Indonesian Education Context)
- **Daily Active Users**: Unique educators accessing platform
- **Submission Rate**: Submissions per active user per day
- **Cohort Completion Rate**: % users completing each LEAPS stage
- **Regional Participation**: Coverage across Indonesian provinces
- **Master Trainer Effectiveness**: Cascading impact metrics

#### Platform Health
- **Review Queue SLA**: < 48 hours average review time
- **Point Calculation Accuracy**: 99.9%+ correctness
- **Anti-Gaming Effectiveness**: < 1% flagged submissions
- **Kajabi Integration**: 99%+ webhook processing success

#### Performance SLAs
```sql
-- SLA Monitoring Queries
-- P95 Response Time for Leaderboard (Target: < 300ms)
SELECT 
  percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_response_time
FROM query_performance_log 
WHERE query_type = 'leaderboard' 
  AND created_at >= NOW() - INTERVAL '1 hour';

-- Daily Submission Success Rate (Target: > 95%)
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_submissions,
  COUNT(*) FILTER (WHERE status != 'FAILED') as successful,
  (COUNT(*) FILTER (WHERE status != 'FAILED') * 100.0 / COUNT(*)) as success_rate
FROM submission_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

## Infrastructure Monitoring

### Database Server Monitoring

#### Core Metrics Collection
```sql
-- Database connection monitoring
CREATE VIEW monitoring_connections AS
SELECT 
  state,
  COUNT(*) as connection_count,
  MAX(now() - state_change) as max_idle_time,
  AVG(now() - query_start) as avg_query_duration
FROM pg_stat_activity 
WHERE pid != pg_backend_pid()
GROUP BY state;

-- Query performance tracking
CREATE VIEW monitoring_slow_queries AS
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  stddev_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_time > 100  -- Queries slower than 100ms
ORDER BY mean_time DESC
LIMIT 20;

-- Index efficiency monitoring
CREATE VIEW monitoring_index_usage AS
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_scan,
  CASE 
    WHEN idx_scan = 0 THEN 'Never used'
    WHEN idx_tup_read = 0 THEN 'Index only scans'
    ELSE ROUND((idx_tup_fetch * 100.0) / idx_tup_read, 2)::text || '%'
  END as usage_ratio
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

#### Resource Utilization Monitoring
```sql
-- Table and index sizes
CREATE VIEW monitoring_storage AS
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - 
                 pg_relation_size(schemaname||'.'||tablename)) as index_size,
  (pg_total_relation_size(schemaname||'.'||tablename))::bigint as total_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY total_bytes DESC;

-- Lock monitoring
CREATE VIEW monitoring_locks AS
SELECT 
  pl.pid,
  pa.usename,
  pa.application_name,
  pa.client_addr,
  pa.query_start,
  pa.state,
  pl.locktype,
  pl.mode,
  pl.granted
FROM pg_locks pl
LEFT JOIN pg_stat_activity pa ON pl.pid = pa.pid
WHERE pl.pid IS NOT NULL
  AND pl.granted = false;
```

### Supabase-Specific Monitoring

#### Pooler Performance
```typescript
// Monitor PgBouncer statistics
export async function getPoolerStats() {
  const stats = await prisma.$queryRaw`
    SELECT 
      database,
      user,
      cl_active,
      cl_waiting,
      sv_active,
      sv_idle,
      sv_used,
      maxwait,
      pool_mode
    FROM pgbouncer.stats;
  `;
  
  return {
    active_connections: stats.reduce((sum, row) => sum + row.cl_active, 0),
    waiting_connections: stats.reduce((sum, row) => sum + row.cl_waiting, 0),
    max_wait_time: Math.max(...stats.map(row => row.maxwait)),
    pool_efficiency: calculatePoolEfficiency(stats)
  };
}

// Connection health check with timeout
export async function healthCheckDatabase(timeoutMs = 5000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Database health check timeout')), timeoutMs)
  );

  try {
    const result = await Promise.race([
      prisma.$queryRaw`SELECT 1 as health_check`,
      timeoutPromise
    ]);
    
    return {
      status: 'healthy',
      latency: Date.now() - startTime,
      result
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      latency: timeoutMs
    };
  }
}
```

## Application-Level Monitoring

### Query Performance Monitoring

#### Automated Performance Tracking
```typescript
// Prisma middleware for query performance logging
export const performanceMiddleware: Prisma.Middleware = async (params, next) => {
  const startTime = Date.now();
  
  try {
    const result = await next(params);
    const duration = Date.now() - startTime;
    
    // Log slow queries
    if (duration > 1000) {
      console.warn(`Slow query detected: ${params.model}.${params.action} took ${duration}ms`);
      
      // Send to monitoring system
      await logSlowQuery({
        model: params.model,
        action: params.action,
        duration,
        args: JSON.stringify(params.args)
      });
    }
    
    // Track all query metrics
    await recordQueryMetrics({
      operation: `${params.model}.${params.action}`,
      duration,
      success: true
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await recordQueryMetrics({
      operation: `${params.model}.${params.action}`,
      duration,
      success: false,
      error: error.message
    });
    
    throw error;
  }
};
```

#### Materialized View Monitoring
```sql
-- View freshness monitoring
CREATE VIEW monitoring_view_freshness AS
SELECT 
  schemaname,
  matviewname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size,
  ispopulated,
  hasindexes,
  -- Estimate last refresh time based on table statistics
  CASE 
    WHEN matviewname = 'leaderboard_totals' THEN 
      (SELECT MAX(last_activity_at) FROM leaderboard_totals)
    WHEN matviewname = 'leaderboard_30d' THEN 
      (SELECT MAX(last_activity_at) FROM leaderboard_30d)
    ELSE NULL
  END as estimated_refresh_time,
  now() - COALESCE(
    (SELECT MAX(last_activity_at) FROM leaderboard_totals WHERE schemaname||'.'||matviewname = 'public.leaderboard_totals'),
    now() - INTERVAL '1 hour'
  ) as staleness_duration
FROM pg_matviews 
WHERE schemaname = 'public';

-- View refresh performance
CREATE TABLE view_refresh_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  view_name TEXT NOT NULL,
  start_time TIMESTAMP DEFAULT NOW(),
  end_time TIMESTAMP,
  duration_ms INTEGER,
  rows_affected INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoint Monitoring

#### Health Check Endpoints
```typescript
// /api/health/comprehensive
export async function GET() {
  const startTime = Date.now();
  
  try {
    const [
      dbHealth,
      viewHealth,
      businessHealth,
      integrationHealth
    ] = await Promise.allSettled([
      checkDatabaseHealth(),
      checkMaterializedViewHealth(),
      checkBusinessLogicHealth(),
      checkIntegrationHealth()
    ]);

    const overallHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      components: {
        database: getSettledValue(dbHealth),
        views: getSettledValue(viewHealth),
        business: getSettledValue(businessHealth),
        integrations: getSettledValue(integrationHealth)
      }
    };

    // Determine overall status
    const hasUnhealthy = Object.values(overallHealth.components)
      .some(component => component?.status === 'unhealthy');
    
    if (hasUnhealthy) {
      overallHealth.status = 'degraded';
    }

    return Response.json(overallHealth, {
      status: overallHealth.status === 'healthy' ? 200 : 503
    });
    
  } catch (error) {
    return Response.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    }, { status: 503 });
  }
}

async function checkBusinessLogicHealth() {
  // Check for business rule violations
  const [duplicateLearn, quotaViolations, orphanedData] = await Promise.all([
    checkDuplicateLearnSubmissions(),
    checkAmplifyQuotaViolations(),
    checkOrphanedRecords()
  ]);

  return {
    status: (duplicateLearn.count + quotaViolations.count + orphanedData.count) === 0 
      ? 'healthy' : 'warning',
    checks: {
      duplicateLearn,
      quotaViolations,
      orphanedData
    }
  };
}
```

## Business Metrics Monitoring

### Indonesian Education Program Metrics

#### Cohort Performance Tracking
```sql
-- Cohort engagement metrics for Indonesian education context
CREATE VIEW monitoring_cohort_performance AS
WITH cohort_stats AS (
  SELECT 
    COALESCE(u.cohort, 'Unassigned') as cohort_name,
    COUNT(DISTINCT u.id) as total_educators,
    COUNT(DISTINCT u.id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM submissions s 
        WHERE s.user_id = u.id 
          AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'
      )
    ) as active_educators,
    
    -- LEAPS stage completion
    COUNT(DISTINCT u.id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM submissions s 
        WHERE s.user_id = u.id AND s.activity_code = 'LEARN' AND s.status = 'APPROVED'
      )
    ) as completed_learn,
    
    COUNT(DISTINCT u.id) FILTER (
      WHERE EXISTS (
        SELECT 1 FROM submissions s 
        WHERE s.user_id = u.id AND s.activity_code = 'EXPLORE' AND s.status = 'APPROVED'
      )
    ) as completed_explore,
    
    -- Regional distribution
    COUNT(DISTINCT COALESCE(u.school, 'Unknown')) as school_count,
    
    -- Performance metrics
    COALESCE(AVG(user_totals.total_points), 0) as avg_points_per_user,
    COALESCE(MAX(user_totals.total_points), 0) as top_user_points
    
  FROM users u
  LEFT JOIN (
    SELECT user_id, SUM(delta_points) as total_points
    FROM points_ledger
    GROUP BY user_id
  ) user_totals ON u.id = user_totals.user_id
  WHERE u.role = 'PARTICIPANT'
  GROUP BY u.cohort
),
national_benchmarks AS (
  SELECT 
    AVG(total_educators) as avg_cohort_size,
    AVG(active_educators * 100.0 / NULLIF(total_educators, 0)) as avg_engagement_rate,
    AVG(completed_learn * 100.0 / NULLIF(total_educators, 0)) as avg_learn_completion,
    AVG(completed_explore * 100.0 / NULLIF(total_educators, 0)) as avg_explore_completion
  FROM cohort_stats
)
SELECT 
  cs.*,
  -- Engagement rates
  ROUND(cs.active_educators * 100.0 / NULLIF(cs.total_educators, 0), 2) as engagement_rate,
  ROUND(cs.completed_learn * 100.0 / NULLIF(cs.total_educators, 0), 2) as learn_completion_rate,
  ROUND(cs.completed_explore * 100.0 / NULLIF(cs.total_educators, 0), 2) as explore_completion_rate,
  
  -- Comparison to national benchmarks
  CASE 
    WHEN (cs.active_educators * 100.0 / NULLIF(cs.total_educators, 0)) > nb.avg_engagement_rate 
    THEN 'Above Average'
    WHEN (cs.active_educators * 100.0 / NULLIF(cs.total_educators, 0)) < nb.avg_engagement_rate * 0.8 
    THEN 'Below Average'
    ELSE 'Average'
  END as engagement_performance,
  
  -- Risk indicators
  CASE 
    WHEN cs.active_educators < cs.total_educators * 0.3 THEN 'High Risk'
    WHEN cs.active_educators < cs.total_educators * 0.6 THEN 'Medium Risk'
    ELSE 'Low Risk'
  END as cohort_risk_level
  
FROM cohort_stats cs
CROSS JOIN national_benchmarks nb
ORDER BY cs.total_educators DESC;
```

#### Regional Impact Monitoring
```sql
-- School and regional distribution metrics
CREATE VIEW monitoring_regional_impact AS
WITH school_performance AS (
  SELECT 
    COALESCE(u.school, 'Unassigned') as school_name,
    COALESCE(u.cohort, 'Unknown') as cohort,
    COUNT(DISTINCT u.id) as educator_count,
    
    -- Activity participation
    COUNT(DISTINCT s.user_id) as active_educators,
    COUNT(s.id) as total_submissions,
    COUNT(s.id) FILTER (WHERE s.status = 'APPROVED') as approved_submissions,
    
    -- Points distribution
    COALESCE(SUM(pl.delta_points), 0) as total_points,
    COALESCE(MAX(user_points.points), 0) as top_educator_points,
    COALESCE(AVG(user_points.points), 0) as avg_points_per_educator,
    
    -- Cascading impact (AMPLIFY metrics)
    COALESCE(SUM((s.payload->>'peersTrained')::int), 0) FILTER (
      WHERE s.activity_code = 'AMPLIFY' AND s.status = 'APPROVED'
    ) as peers_trained,
    COALESCE(SUM((s.payload->>'studentsTrained')::int), 0) FILTER (
      WHERE s.activity_code = 'AMPLIFY' AND s.status = 'APPROVED'
    ) as students_trained
    
  FROM users u
  LEFT JOIN submissions s ON u.id = s.user_id
  LEFT JOIN points_ledger pl ON u.id = pl.user_id
  LEFT JOIN (
    SELECT user_id, SUM(delta_points) as points
    FROM points_ledger
    GROUP BY user_id
  ) user_points ON u.id = user_points.user_id
  WHERE u.role = 'PARTICIPANT'
  GROUP BY u.school, u.cohort
)
SELECT 
  *,
  -- Participation rate
  ROUND(active_educators * 100.0 / NULLIF(educator_count, 0), 2) as participation_rate,
  
  -- Approval rate
  ROUND(approved_submissions * 100.0 / NULLIF(total_submissions, 0), 2) as approval_rate,
  
  -- Impact multiplier (cascading effect)
  (peers_trained + students_trained) as total_impact,
  ROUND((peers_trained + students_trained) / NULLIF(educator_count, 1), 2) as impact_per_educator,
  
  -- Performance classification
  CASE 
    WHEN active_educators = educator_count AND total_points > 0 THEN 'High Performing'
    WHEN active_educators >= educator_count * 0.7 THEN 'Good Performing'
    WHEN active_educators >= educator_count * 0.4 THEN 'Moderate Performing'
    ELSE 'Needs Attention'
  END as performance_tier
  
FROM school_performance
WHERE educator_count > 0
ORDER BY total_points DESC, participation_rate DESC;
```

### Submission Pipeline Monitoring

#### Review Queue Health
```sql
-- Review queue monitoring with SLA tracking
CREATE VIEW monitoring_review_queue AS
WITH queue_stats AS (
  SELECT 
    s.activity_code,
    COUNT(*) as pending_count,
    MIN(s.created_at) as oldest_submission,
    MAX(s.created_at) as newest_submission,
    AVG(EXTRACT(EPOCH FROM (NOW() - s.created_at))/3600) as avg_wait_hours,
    COUNT(*) FILTER (WHERE s.created_at < NOW() - INTERVAL '48 hours') as overdue_count,
    COUNT(*) FILTER (WHERE s.created_at < NOW() - INTERVAL '24 hours') as urgent_count
  FROM submissions s
  WHERE s.status = 'PENDING'
  GROUP BY s.activity_code
),
reviewer_stats AS (
  SELECT 
    COUNT(DISTINCT reviewer_id) FILTER (WHERE reviewer_id IS NOT NULL) as active_reviewers,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/3600) as avg_review_time_hours
  FROM submissions
  WHERE status IN ('APPROVED', 'REJECTED')
    AND updated_at >= NOW() - INTERVAL '7 days'
)
SELECT 
  qs.*,
  rs.active_reviewers,
  rs.avg_review_time_hours,
  
  -- SLA compliance
  CASE 
    WHEN qs.overdue_count > 0 THEN 'SLA Breach'
    WHEN qs.urgent_count > qs.pending_count * 0.5 THEN 'SLA Risk'
    ELSE 'SLA Compliant'
  END as sla_status,
  
  -- Priority classification
  CASE 
    WHEN qs.overdue_count > 10 THEN 'Critical'
    WHEN qs.urgent_count > 20 THEN 'High'
    WHEN qs.pending_count > 50 THEN 'Medium'
    ELSE 'Normal'
  END as queue_priority
  
FROM queue_stats qs
CROSS JOIN reviewer_stats rs
ORDER BY qs.overdue_count DESC, qs.urgent_count DESC;
```

## Alert Configuration

### Critical Alerts (Immediate Response)

#### Database Connectivity
```yaml
# Alert: Database Connection Failure
alert: database_connection_failure
expr: up{job="database"} == 0
for: 1m
labels:
  severity: critical
  team: database
annotations:
  summary: "Database is unreachable"
  description: "Database connection has been down for more than 1 minute"
  runbook: "https://docs.elevate.org/runbooks/database-outage"
```

```typescript
// Health check with alerting
export async function monitorDatabaseConnection() {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    
    // Reset alert state
    await updateAlertStatus('database_connection', 'healthy');
    
    return { status: 'healthy' };
  } catch (error) {
    // Trigger immediate alert
    await triggerAlert({
      type: 'database_connection_failure',
      severity: 'critical',
      message: `Database connection failed: ${error.message}`,
      timestamp: new Date(),
      metadata: {
        error_code: error.code,
        error_detail: error.detail
      }
    });
    
    throw error;
  }
}
```

#### Business Rule Violations
```sql
-- Monitor for AMPLIFY quota violations
CREATE OR REPLACE FUNCTION monitor_amplify_violations()
RETURNS TABLE(
  user_id TEXT,
  total_peers INTEGER,
  total_students INTEGER,
  violation_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.user_id,
    SUM((s.payload->>'peersTrained')::int) as total_peers,
    SUM((s.payload->>'studentsTrained')::int) as total_students,
    CASE 
      WHEN SUM((s.payload->>'peersTrained')::int) > 50 THEN 'PEER_LIMIT_EXCEEDED'
      WHEN SUM((s.payload->>'studentsTrained')::int) > 200 THEN 'STUDENT_LIMIT_EXCEEDED'
    END as violation_type
  FROM submissions s
  WHERE s.activity_code = 'AMPLIFY'
    AND s.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
  GROUP BY s.user_id
  HAVING 
    SUM((s.payload->>'peersTrained')::int) > 50 OR
    SUM((s.payload->>'studentsTrained')::int) > 200;
END;
$$ LANGUAGE plpgsql;
```

### Warning Alerts (Action Required)

#### Performance Degradation
```typescript
// Query performance monitoring
export async function monitorQueryPerformance() {
  const slowQueries = await prisma.$queryRaw`
    SELECT 
      query,
      calls,
      mean_time,
      total_time
    FROM pg_stat_statements 
    WHERE mean_time > 1000  -- Queries slower than 1 second
    ORDER BY mean_time DESC
    LIMIT 10
  `;

  if (slowQueries.length > 0) {
    await triggerAlert({
      type: 'slow_query_detected',
      severity: 'warning',
      message: `${slowQueries.length} slow queries detected`,
      metadata: {
        queries: slowQueries.map(q => ({
          query: q.query.substring(0, 200) + '...',
          mean_time: q.mean_time,
          calls: q.calls
        }))
      }
    });
  }
}
```

#### Review Queue Backlog
```sql
-- Review queue SLA monitoring
CREATE OR REPLACE FUNCTION monitor_review_sla()
RETURNS TABLE(
  activity_code TEXT,
  pending_count BIGINT,
  overdue_count BIGINT,
  sla_breach BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.activity_code,
    COUNT(*) as pending_count,
    COUNT(*) FILTER (WHERE s.created_at < NOW() - INTERVAL '48 hours') as overdue_count,
    (COUNT(*) FILTER (WHERE s.created_at < NOW() - INTERVAL '48 hours') > 0) as sla_breach
  FROM submissions s
  WHERE s.status = 'PENDING'
  GROUP BY s.activity_code
  HAVING COUNT(*) FILTER (WHERE s.created_at < NOW() - INTERVAL '48 hours') > 0;
END;
$$ LANGUAGE plpgsql;
```

### Informational Alerts (Monitoring)

#### Daily Summary Reports
```typescript
// Daily metrics summary
export async function generateDailyReport() {
  const [
    userMetrics,
    submissionMetrics,
    performanceMetrics,
    businessMetrics
  ] = await Promise.all([
    getDailyUserMetrics(),
    getDailySubmissionMetrics(),
    getDailyPerformanceMetrics(),
    getDailyBusinessMetrics()
  ]);

  const report = {
    date: new Date().toISOString().split('T')[0],
    metrics: {
      users: userMetrics,
      submissions: submissionMetrics,
      performance: performanceMetrics,
      business: businessMetrics
    },
    summary: generateSummaryInsights({
      userMetrics,
      submissionMetrics,
      performanceMetrics,
      businessMetrics
    })
  };

  // Send to monitoring channel
  await sendToSlackChannel('#elevate-metrics', formatDailyReport(report));
  
  return report;
}

async function getDailyBusinessMetrics() {
  const today = new Date().toISOString().split('T')[0];
  
  return {
    // Indonesian education specific metrics
    new_educators: await prisma.user.count({
      where: {
        role: 'PARTICIPANT',
        created_at: {
          gte: new Date(today),
          lt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      }
    }),
    
    // LEAPS progression
    learn_completions: await prisma.submission.count({
      where: {
        activity_code: 'LEARN',
        status: 'APPROVED',
        updated_at: {
          gte: new Date(today)
        }
      }
    }),
    
    // Amplify impact
    daily_amplify_impact: await prisma.$queryRaw`
      SELECT 
        COALESCE(SUM((payload->>'peersTrained')::int), 0) as peers_trained,
        COALESCE(SUM((payload->>'studentsTrained')::int), 0) as students_trained
      FROM submissions
      WHERE activity_code = 'AMPLIFY' 
        AND status = 'APPROVED'
        AND DATE(updated_at) = CURRENT_DATE
    `,
    
    // Regional coverage
    active_schools: await prisma.user.groupBy({
      by: ['school'],
      where: {
        role: 'PARTICIPANT',
        submissions: {
          some: {
            created_at: {
              gte: new Date(today)
            }
          }
        }
      },
      _count: true
    }).then(results => results.length)
  };
}
```

## Dashboard Setup

### Grafana Dashboard Configuration

#### Database Performance Dashboard
```json
{
  "dashboard": {
    "title": "MS Elevate - Database Performance",
    "panels": [
      {
        "title": "Connection Pool Usage",
        "type": "stat",
        "targets": [
          {
            "expr": "pg_stat_activity_count / pg_settings_max_connections * 100",
            "legendFormat": "Connection Usage %"
          }
        ],
        "thresholds": [
          {"color": "green", "value": 0},
          {"color": "yellow", "value": 70},
          {"color": "red", "value": 85}
        ]
      },
      {
        "title": "Query Response Times",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))",
            "legendFormat": "95th Percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(db_query_duration_seconds_bucket[5m]))",
            "legendFormat": "50th Percentile"
          }
        ]
      },
      {
        "title": "Slow Queries",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, rate(db_slow_queries_total[5m]))",
            "format": "table"
          }
        ]
      }
    ]
  }
}
```

#### Business Metrics Dashboard
```json
{
  "dashboard": {
    "title": "MS Elevate - Education Impact",
    "panels": [
      {
        "title": "Daily Active Educators",
        "type": "graph",
        "targets": [
          {
            "rawSql": "SELECT time_bucket('1 day', created_at) as time, COUNT(DISTINCT user_id) as active_users FROM submissions WHERE $__timeFilter(created_at) GROUP BY time ORDER BY time",
            "format": "time_series"
          }
        ]
      },
      {
        "title": "LEAPS Stage Completion Funnel",
        "type": "piechart",
        "targets": [
          {
            "rawSql": "SELECT activity_code as stage, COUNT(DISTINCT user_id) as completions FROM submissions WHERE status = 'APPROVED' GROUP BY activity_code"
          }
        ]
      },
      {
        "title": "Regional Participation Map",
        "type": "worldmap",
        "targets": [
          {
            "rawSql": "SELECT school as location, COUNT(*) as participants FROM users WHERE role = 'PARTICIPANT' AND school IS NOT NULL GROUP BY school"
          }
        ]
      },
      {
        "title": "Cohort Performance Rankings",
        "type": "table",
        "targets": [
          {
            "rawSql": "SELECT cohort, total_educators, engagement_rate, avg_points_per_user FROM monitoring_cohort_performance ORDER BY engagement_rate DESC"
          }
        ]
      }
    ]
  }
}
```

### Custom Analytics Views

#### Real-time Metrics API
```typescript
// /api/analytics/realtime
export async function GET() {
  const [
    activeUsers,
    pendingSubmissions,
    recentActivity,
    systemHealth
  ] = await Promise.all([
    getActiveUsersLast24Hours(),
    getPendingSubmissionsByActivity(),
    getRecentActivityTimeline(),
    getSystemHealthMetrics()
  ]);

  return Response.json({
    timestamp: new Date().toISOString(),
    metrics: {
      active_users: activeUsers,
      pending_submissions: pendingSubmissions,
      recent_activity: recentActivity,
      system_health: systemHealth
    }
  });
}

async function getActiveUsersLast24Hours() {
  return prisma.user.count({
    where: {
      submissions: {
        some: {
          created_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }
    }
  });
}

async function getRecentActivityTimeline() {
  const activities = await prisma.submission.findMany({
    take: 50,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      activity_code: true,
      status: true,
      created_at: true,
      user: {
        select: {
          name: true,
          handle: true,
          school: true,
          cohort: true
        }
      }
    }
  });

  return activities.map(activity => ({
    timestamp: activity.created_at,
    type: activity.activity_code,
    status: activity.status,
    user: activity.user.name,
    metadata: {
      school: activity.user.school,
      cohort: activity.user.cohort
    }
  }));
}
```

## Log Analysis

### Application Log Monitoring

#### Structured Logging Setup
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.metadata()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Database operation logging
export function logDatabaseOperation(operation: string, duration: number, success: boolean, metadata?: any) {
  logger.info('database_operation', {
    operation,
    duration,
    success,
    ...metadata,
    tags: ['database', 'performance']
  });
}

// Business logic logging
export function logBusinessEvent(event: string, userId: string, metadata?: any) {
  logger.info('business_event', {
    event,
    userId,
    ...metadata,
    tags: ['business', 'audit']
  });
}
```

#### Log Analysis Queries

##### Error Pattern Detection
```bash
# Common database errors
grep -E "(connection|timeout|constraint|deadlock)" logs/error.log | 
  jq -r '.message' | 
  sort | 
  uniq -c | 
  sort -nr

# Performance anomalies
grep "slow_query" logs/combined.log | 
  jq -r 'select(.duration > 1000) | .operation' |
  sort | 
  uniq -c | 
  sort -nr

# Business logic violations
grep "business_event" logs/combined.log | 
  jq -r 'select(.event == "amplify_quota_exceeded") | .userId' |
  sort | 
  uniq -c
```

##### Indonesian Context Monitoring
```bash
# Regional activity patterns
grep "submission_created" logs/combined.log | 
  jq -r '.metadata.school' | 
  grep -v null | 
  sort | 
  uniq -c | 
  sort -nr | 
  head -20

# Cohort engagement trends
grep "user_login" logs/combined.log | 
  jq -r '.metadata.cohort' | 
  grep -v null | 
  sort | 
  uniq -c | 
  sort -nr
```

### Database Log Analysis

#### PostgreSQL Log Monitoring
```sql
-- Enable logging for monitoring
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1s
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;
SELECT pg_reload_conf();

-- Create log analysis views
CREATE VIEW monitoring_log_analysis AS
SELECT 
  date_trunc('hour', log_time) as hour,
  COUNT(*) as total_entries,
  COUNT(*) FILTER (WHERE message ILIKE '%error%') as error_count,
  COUNT(*) FILTER (WHERE message ILIKE '%slow%') as slow_query_count,
  COUNT(*) FILTER (WHERE message ILIKE '%connection%') as connection_events
FROM pg_log
WHERE log_time >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

## Performance Baselines

### Established Benchmarks

#### Response Time Baselines (Indonesian Network Conditions)
- **Leaderboard Load**: < 500ms P95 (considering Southeast Asian latency)
- **Submission Form**: < 300ms initial load
- **Dashboard Navigation**: < 200ms between pages
- **File Upload**: < 30 seconds for 10MB files
- **Analytics Refresh**: < 2 minutes for all materialized views

#### Database Performance Baselines
```sql
-- Baseline query performance benchmarks
CREATE TABLE performance_baselines (
  operation VARCHAR(100) PRIMARY KEY,
  baseline_p50_ms INTEGER,
  baseline_p95_ms INTEGER,
  baseline_p99_ms INTEGER,
  target_p50_ms INTEGER,
  target_p95_ms INTEGER,
  target_p99_ms INTEGER,
  last_updated TIMESTAMP DEFAULT NOW()
);

INSERT INTO performance_baselines VALUES
('leaderboard_query', 50, 200, 500, 30, 100, 300),
('submission_create', 20, 100, 200, 15, 50, 100),
('user_profile_load', 10, 50, 100, 10, 30, 50),
('analytics_refresh', 30000, 120000, 180000, 20000, 60000, 120000),
('review_queue_load', 100, 300, 500, 50, 150, 250);
```

#### Business Metrics Baselines
```sql
-- Indonesian education program baselines
CREATE TABLE business_baselines (
  metric_name VARCHAR(100) PRIMARY KEY,
  target_value NUMERIC,
  warning_threshold NUMERIC,
  critical_threshold NUMERIC,
  unit VARCHAR(50),
  description TEXT,
  last_updated TIMESTAMP DEFAULT NOW()
);

INSERT INTO business_baselines VALUES
('daily_active_educators', 100, 50, 25, 'count', 'Daily unique educators accessing platform'),
('submission_approval_rate', 95.0, 85.0, 70.0, 'percentage', 'Percentage of submissions approved'),
('review_sla_compliance', 98.0, 90.0, 80.0, 'percentage', 'Reviews completed within 48 hours'),
('cohort_engagement_rate', 80.0, 60.0, 40.0, 'percentage', 'Educators active per cohort'),
('amplify_impact_multiplier', 5.0, 3.0, 2.0, 'ratio', 'Students+peers trained per educator'),
('regional_coverage', 75.0, 60.0, 40.0, 'percentage', 'Indonesian provinces with active schools');
```

### Performance Regression Detection

#### Automated Baseline Monitoring
```typescript
// Performance regression detection
export async function checkPerformanceRegression() {
  const currentMetrics = await getCurrentPerformanceMetrics();
  const baselines = await getPerformanceBaselines();
  
  const regressions = [];
  
  for (const [operation, current] of Object.entries(currentMetrics)) {
    const baseline = baselines[operation];
    if (!baseline) continue;
    
    // Check for performance regression (>20% slower than baseline)
    if (current.p95 > baseline.baseline_p95_ms * 1.2) {
      regressions.push({
        operation,
        current_p95: current.p95,
        baseline_p95: baseline.baseline_p95_ms,
        regression_percentage: ((current.p95 - baseline.baseline_p95_ms) / baseline.baseline_p95_ms * 100).toFixed(1)
      });
    }
  }
  
  if (regressions.length > 0) {
    await triggerAlert({
      type: 'performance_regression',
      severity: 'warning',
      message: `Performance regression detected in ${regressions.length} operations`,
      metadata: { regressions }
    });
  }
  
  return regressions;
}
```

## Monitoring Automation

### Automated Monitoring Tasks

#### Scheduled Health Checks
```typescript
// Cron job for comprehensive monitoring
export async function scheduledMonitoring() {
  console.log('Starting scheduled monitoring run...');
  
  try {
    // Run all monitoring checks in parallel
    const [
      connectionHealth,
      performanceCheck,
      businessRulesCheck,
      integrityCheck,
      alertsCheck
    ] = await Promise.allSettled([
      checkDatabaseConnection(),
      checkPerformanceRegression(),
      checkBusinessRuleViolations(),
      checkDataIntegrity(),
      processAlertQueue()
    ]);
    
    // Log monitoring results
    const results = {
      connection: getSettledResult(connectionHealth),
      performance: getSettledResult(performanceCheck),
      business_rules: getSettledResult(businessRulesCheck),
      data_integrity: getSettledResult(integrityCheck),
      alerts: getSettledResult(alertsCheck)
    };
    
    await logMonitoringResults(results);
    
    // Send summary if any issues found
    const issuesFound = Object.values(results).some(result => 
      result.status === 'error' || (result.data && result.data.length > 0)
    );
    
    if (issuesFound) {
      await sendMonitoringSummary(results);
    }
    
  } catch (error) {
    console.error('Scheduled monitoring failed:', error);
    
    await triggerAlert({
      type: 'monitoring_system_failure',
      severity: 'critical',
      message: `Scheduled monitoring system failed: ${error.message}`
    });
  }
}

// Run every 5 minutes
export const monitoringSchedule = '*/5 * * * *';
```

#### Self-Healing Operations
```typescript
// Automated recovery procedures
export async function attemptAutomaticRecovery(issueType: string, metadata: any) {
  console.log(`Attempting automatic recovery for: ${issueType}`);
  
  switch (issueType) {
    case 'materialized_view_stale':
      try {
        await prisma.$executeRaw`SELECT refresh_all_analytics();`;
        console.log('✅ Materialized views refreshed automatically');
        return { success: true, action: 'views_refreshed' };
      } catch (error) {
        console.error('❌ Failed to refresh views automatically:', error);
        return { success: false, error: error.message };
      }
    
    case 'connection_pool_exhausted':
      try {
        // Kill idle connections
        await prisma.$executeRaw`
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE state = 'idle' 
            AND now() - state_change > interval '10 minutes'
        `;
        console.log('✅ Idle connections terminated');
        return { success: true, action: 'idle_connections_killed' };
      } catch (error) {
        console.error('❌ Failed to clean up connections:', error);
        return { success: false, error: error.message };
      }
    
    case 'review_queue_overdue':
      try {
        // Send escalation notification
        await notifyReviewerEscalation(metadata.overdueCount);
        console.log('✅ Reviewer escalation sent');
        return { success: true, action: 'escalation_sent' };
      } catch (error) {
        console.error('❌ Failed to send escalation:', error);
        return { success: false, error: error.message };
      }
    
    default:
      console.log(`No automatic recovery available for: ${issueType}`);
      return { success: false, reason: 'no_recovery_procedure' };
  }
}
```

### Monitoring Data Retention

#### Cleanup Procedures
```sql
-- Monitoring data retention policy
CREATE OR REPLACE FUNCTION cleanup_monitoring_data()
RETURNS void AS $$
BEGIN
  -- Clean up old performance logs (keep 30 days)
  DELETE FROM query_performance_log 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Clean up old alert history (keep 90 days)
  DELETE FROM alert_history 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Clean up old view refresh logs (keep 7 days)
  DELETE FROM view_refresh_log 
  WHERE created_at < NOW() - INTERVAL '7 days';
  
  -- Vacuum to reclaim space
  VACUUM ANALYZE query_performance_log;
  VACUUM ANALYZE alert_history;
  VACUUM ANALYZE view_refresh_log;
  
  RAISE NOTICE 'Monitoring data cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup weekly
SELECT cron.schedule('monitoring-cleanup', '0 2 * * 0', 'SELECT cleanup_monitoring_data();');
```

### Integration with External Systems

#### Slack Integration
```typescript
// Send monitoring alerts to Slack
export async function sendToSlackChannel(channel: string, message: string, severity: 'info' | 'warning' | 'error' = 'info') {
  const colors = {
    info: '#36a64f',      // Green
    warning: '#ff9f00',   // Orange  
    error: '#ff0000'      // Red
  };
  
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return;
  
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel,
      attachments: [{
        color: colors[severity],
        title: `MS Elevate - ${severity.toUpperCase()}`,
        text: message,
        timestamp: Math.floor(Date.now() / 1000)
      }]
    })
  });
}

// Format daily monitoring report for Slack
export function formatDailyReport(report: any) {
  return `
📊 *MS Elevate Daily Report* - ${report.date}

*User Activity:*
• New Educators: ${report.metrics.users.new_educators}
• Active Schools: ${report.metrics.business.active_schools}
• Daily Submissions: ${report.metrics.submissions.total_created}

*LEAPS Progress:*
• Learn Completions: ${report.metrics.business.learn_completions}
• Amplify Impact: ${report.metrics.business.daily_amplify_impact?.peers_trained} peers, ${report.metrics.business.daily_amplify_impact?.students_trained} students trained

*System Health:*
• Database Response: ${report.metrics.performance.avg_response_time}ms avg
• Review Queue: ${report.metrics.submissions.pending_reviews} pending
• SLA Compliance: ${report.metrics.performance.sla_compliance}%

${report.summary.length > 0 ? '\n*Key Insights:*\n' + report.summary.map(insight => `• ${insight}`).join('\n') : ''}
  `.trim();
}
```

This comprehensive monitoring guide provides the foundation for maintaining a healthy, performant database system that supports the MS Elevate LEAPS Tracker's mission of empowering Indonesian educators with AI technology. Regular monitoring ensures optimal user experience and platform reliability across diverse network conditions and usage patterns in the Indonesian education landscape.