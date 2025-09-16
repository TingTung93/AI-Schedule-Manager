# Variables for AI Schedule Manager Infrastructure

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-west-2"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "owner" {
  description = "Owner tag for resources"
  type        = string
  default     = "ai-schedule-manager-team"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnets" {
  description = "Private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnets" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "database_subnets" {
  description = "Database subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]
}

# EKS Configuration
variable "cluster_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "eks_node_instance_types" {
  description = "Instance types for EKS managed node group"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "eks_spot_instance_types" {
  description = "Instance types for EKS spot node group"
  type        = list(string)
  default     = ["t3.medium", "t3.large", "t3a.medium", "t3a.large"]
}

variable "eks_node_group_min_size" {
  description = "Minimum number of nodes in managed node group"
  type        = number
  default     = 2
}

variable "eks_node_group_max_size" {
  description = "Maximum number of nodes in managed node group"
  type        = number
  default     = 10
}

variable "eks_node_group_desired_size" {
  description = "Desired number of nodes in managed node group"
  type        = number
  default     = 3
}

# RDS Configuration
variable "db_engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "15.4"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for RDS instance (GB)"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS instance (GB)"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "ai_schedule_manager"
}

variable "db_username" {
  description = "Username for the database"
  type        = string
  default     = "postgres"
}

variable "db_backup_retention_period" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
}

# Redis Configuration
variable "redis_node_type" {
  description = "Node type for Redis cluster"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes in Redis cluster"
  type        = number
  default     = 1
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "yourdomain.com"
}

variable "subdomain_api" {
  description = "Subdomain for API"
  type        = string
  default     = "api"
}

variable "subdomain_staging" {
  description = "Subdomain for staging environment"
  type        = string
  default     = "staging"
}

# SSL Certificate Configuration
variable "acm_certificate_domain" {
  description = "Domain for ACM certificate"
  type        = string
  default     = "*.yourdomain.com"
}

# Monitoring Configuration
variable "enable_container_insights" {
  description = "Enable Container Insights for EKS cluster"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 14
}

# Security Configuration
variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access ALB"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Restrict this in production
}

variable "enable_waf" {
  description = "Enable AWS WAF for ALB"
  type        = bool
  default     = false
}

# Backup Configuration
variable "backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for RDS"
  type        = bool
  default     = true
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Enable spot instances for cost optimization"
  type        = bool
  default     = true
}

variable "schedule_scaling" {
  description = "Enable scheduled scaling for cost optimization"
  type        = bool
  default     = false
}

# Feature Flags
variable "enable_external_secrets" {
  description = "Enable External Secrets Operator"
  type        = bool
  default     = false
}

variable "enable_service_mesh" {
  description = "Enable Istio service mesh"
  type        = bool
  default     = false
}

variable "enable_monitoring_stack" {
  description = "Enable Prometheus and Grafana monitoring stack"
  type        = bool
  default     = true
}

# Environment-specific variables
variable "environment_config" {
  description = "Environment-specific configuration"
  type = object({
    min_replicas             = number
    max_replicas             = number
    cpu_requests             = string
    memory_requests          = string
    cpu_limits               = string
    memory_limits            = string
    enable_autoscaling       = bool
    enable_pod_disruption_budget = bool
  })
  default = {
    min_replicas             = 2
    max_replicas             = 10
    cpu_requests             = "100m"
    memory_requests          = "128Mi"
    cpu_limits               = "500m"
    memory_limits            = "512Mi"
    enable_autoscaling       = true
    enable_pod_disruption_budget = true
  }
}

# Multi-region configuration
variable "enable_multi_region" {
  description = "Enable multi-region deployment"
  type        = bool
  default     = false
}

variable "backup_region" {
  description = "Backup AWS region for disaster recovery"
  type        = string
  default     = "us-east-1"
}

# Compliance and governance
variable "enable_config_rules" {
  description = "Enable AWS Config rules for compliance"
  type        = bool
  default     = false
}

variable "enable_cloudtrail" {
  description = "Enable CloudTrail for auditing"
  type        = bool
  default     = true
}

variable "enable_guardduty" {
  description = "Enable GuardDuty for threat detection"
  type        = bool
  default     = false
}

# Notification configuration
variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications"
  type        = string
  default     = ""
  sensitive   = true
}

variable "email_notifications" {
  description = "Email addresses for notifications"
  type        = list(string)
  default     = []
}

# Additional tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}