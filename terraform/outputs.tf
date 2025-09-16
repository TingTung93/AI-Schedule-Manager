# Outputs for AI Schedule Manager Infrastructure

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "database_subnets" {
  description = "List of IDs of database subnets"
  value       = module.vpc.database_subnets
}

# EKS Outputs
output "cluster_name" {
  description = "Name of the EKS cluster"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_version" {
  description = "The Kubernetes version for the EKS cluster"
  value       = module.eks.cluster_version
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = module.eks.cluster_certificate_authority_data
}

output "cluster_oidc_issuer_url" {
  description = "The URL on the EKS cluster for the OpenID Connect identity provider"
  value       = module.eks.cluster_oidc_issuer_url
}

output "node_groups" {
  description = "EKS node groups"
  value       = module.eks.eks_managed_node_groups
  sensitive   = true
}

# RDS Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.db_instance_endpoint
}

output "rds_port" {
  description = "RDS instance port"
  value       = module.rds.db_instance_port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = module.rds.db_instance_name
}

output "rds_username" {
  description = "RDS instance root username"
  value       = module.rds.db_instance_username
  sensitive   = true
}

output "rds_password" {
  description = "RDS instance password"
  value       = module.rds.db_instance_password
  sensitive   = true
}

# Redis Outputs
output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.redis.cache_cluster_address
}

output "redis_port" {
  description = "Redis cluster port"
  value       = module.redis.cache_cluster_port
}

output "redis_auth_token" {
  description = "Redis auth token"
  value       = module.redis.auth_token
  sensitive   = true
}

# Load Balancer Outputs
output "alb_dns_name" {
  description = "The DNS name of the load balancer"
  value       = module.alb.lb_dns_name
}

output "alb_zone_id" {
  description = "The zone ID of the load balancer"
  value       = module.alb.lb_zone_id
}

output "alb_arn" {
  description = "The ARN of the load balancer"
  value       = module.alb.lb_arn
}

# S3 Outputs
output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = module.s3.bucket_name
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = module.s3.bucket_arn
}

# Security Group Outputs
output "eks_security_group_id" {
  description = "Security group ID for EKS cluster"
  value       = module.security_groups.eks_security_group_id
}

output "rds_security_group_id" {
  description = "Security group ID for RDS"
  value       = module.security_groups.rds_security_group_id
}

output "redis_security_group_id" {
  description = "Security group ID for Redis"
  value       = module.security_groups.redis_security_group_id
}

output "alb_security_group_id" {
  description = "Security group ID for ALB"
  value       = module.security_groups.alb_security_group_id
}

# Monitoring Outputs
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = module.monitoring.log_group_name
}

# Connection Information
output "kubectl_config_command" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}

output "database_url" {
  description = "Database connection URL"
  value       = "postgresql://${module.rds.db_instance_username}:${module.rds.db_instance_password}@${module.rds.db_instance_endpoint}:${module.rds.db_instance_port}/${module.rds.db_instance_name}"
  sensitive   = true
}

output "redis_url" {
  description = "Redis connection URL"
  value       = "redis://:${module.redis.auth_token}@${module.redis.cache_cluster_address}:${module.redis.cache_cluster_port}/0"
  sensitive   = true
}

# Environment Information
output "environment" {
  description = "Environment name"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "account_id" {
  description = "AWS account ID"
  value       = data.aws_caller_identity.current.account_id
}

# Deployment Information
output "deployment_info" {
  description = "Key deployment information"
  value = {
    environment     = var.environment
    cluster_name    = module.eks.cluster_name
    cluster_endpoint = module.eks.cluster_endpoint
    database_endpoint = module.rds.db_instance_endpoint
    redis_endpoint  = module.redis.cache_cluster_address
    load_balancer   = module.alb.lb_dns_name
    region         = var.aws_region
    vpc_id         = module.vpc.vpc_id
    subnets = {
      private  = module.vpc.private_subnets
      public   = module.vpc.public_subnets
      database = module.vpc.database_subnets
    }
  }
}

# HELM Release Status (if enabled)
output "helm_releases" {
  description = "Status of Helm releases"
  value = {
    aws_load_balancer_controller = {
      name      = helm_release.aws_load_balancer_controller.name
      namespace = helm_release.aws_load_balancer_controller.namespace
      status    = helm_release.aws_load_balancer_controller.status
    }
    cluster_autoscaler = {
      name      = helm_release.cluster_autoscaler.name
      namespace = helm_release.cluster_autoscaler.namespace
      status    = helm_release.cluster_autoscaler.status
    }
    cert_manager = {
      name      = helm_release.cert_manager.name
      namespace = helm_release.cert_manager.namespace
      status    = helm_release.cert_manager.status
    }
  }
}

# Quick Start Commands
output "quick_start_commands" {
  description = "Quick start commands for deployment"
  value = {
    configure_kubectl = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
    verify_cluster    = "kubectl cluster-info"
    deploy_app        = "kubectl apply -f k8s/"
    check_pods        = "kubectl get pods -n ai-schedule-manager"
    check_services    = "kubectl get services -n ai-schedule-manager"
    port_forward_api  = "kubectl port-forward -n ai-schedule-manager service/ai-schedule-backend-service 8000:8000"
    port_forward_web  = "kubectl port-forward -n ai-schedule-manager service/ai-schedule-frontend-service 3000:80"
  }
}

# Cost Estimation
output "estimated_monthly_cost" {
  description = "Estimated monthly cost breakdown (approximate)"
  value = {
    eks_cluster    = "~$72 (cluster) + ~$30-150 (nodes)"
    rds_database   = "~$15-50 (depends on instance type)"
    redis_cache    = "~$15-30 (depends on node type)"
    load_balancer  = "~$20-25"
    data_transfer  = "~$10-50 (depends on usage)"
    storage        = "~$5-20 (depends on usage)"
    total_estimate = "~$167-347 per month"
    note          = "Costs vary by region, usage, and instance types. Enable spot instances and right-sizing for cost optimization."
  }
}

# Security Information
output "security_considerations" {
  description = "Important security considerations"
  value = {
    update_security_groups = "Review and restrict security group rules"
    enable_pod_security    = "Enable Pod Security Standards"
    setup_rbac            = "Configure proper RBAC permissions"
    enable_encryption     = "Verify encryption at rest and in transit"
    setup_monitoring      = "Configure security monitoring and alerting"
    backup_strategy       = "Implement backup and disaster recovery"
    secrets_management    = "Use AWS Secrets Manager or External Secrets"
  }
}