# AI Schedule Manager Infrastructure
# This file defines the main infrastructure components

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Remote state backend
  backend "s3" {
    # Configure via environment variables or CLI
    # bucket = "your-terraform-state-bucket"
    # key    = "ai-schedule-manager/terraform.tfstate"
    # region = "us-west-2"
    # encrypt = true
    # dynamodb_table = "terraform-locks"
  }
}

# Configure providers
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ai-schedule-manager"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = var.owner
    }
  }
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

data "aws_caller_identity" "current" {}

# Local values
locals {
  name = "ai-schedule-manager-${var.environment}"

  vpc_cidr = var.vpc_cidr
  azs      = slice(data.aws_availability_zones.available.names, 0, 3)

  tags = {
    Project     = "ai-schedule-manager"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  name = local.name
  cidr = local.vpc_cidr

  azs             = local.azs
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets
  database_subnets = var.database_subnets

  enable_nat_gateway = true
  enable_vpn_gateway = false
  enable_dns_hostnames = true
  enable_dns_support = true

  # VPC Flow Logs
  enable_flow_log                      = true
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_cloudwatch_iam_role  = true

  tags = local.tags
}

# EKS Cluster
module "eks" {
  source = "./modules/eks"

  cluster_name    = local.name
  cluster_version = var.cluster_version

  vpc_id                          = module.vpc.vpc_id
  subnet_ids                      = module.vpc.private_subnets
  control_plane_subnet_ids        = module.vpc.private_subnets

  # OIDC Identity provider
  cluster_identity_providers = {
    sts = {
      client_id = "sts.amazonaws.com"
    }
  }

  # Managed node groups
  managed_node_groups = {
    main = {
      name           = "${local.name}-main"
      instance_types = var.eks_node_instance_types

      min_size     = var.eks_node_group_min_size
      max_size     = var.eks_node_group_max_size
      desired_size = var.eks_node_group_desired_size

      disk_size = 50
      ami_type  = "AL2_x86_64"
      capacity_type = "ON_DEMAND"

      labels = {
        role = "main"
      }

      taints = []

      tags = local.tags
    }

    spot = {
      name           = "${local.name}-spot"
      instance_types = var.eks_spot_instance_types

      min_size     = 0
      max_size     = 10
      desired_size = 2

      disk_size = 50
      ami_type  = "AL2_x86_64"
      capacity_type = "SPOT"

      labels = {
        role = "spot"
      }

      taints = [
        {
          key    = "spot"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      ]

      tags = local.tags
    }
  }

  tags = local.tags
}

# RDS Database
module "rds" {
  source = "./modules/rds"

  identifier = "${local.name}-postgres"

  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage

  db_name  = var.db_name
  username = var.db_username
  port     = 5432

  vpc_security_group_ids = [module.security_groups.rds_security_group_id]
  db_subnet_group_name   = module.vpc.database_subnet_group

  backup_retention_period = var.db_backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  enabled_cloudwatch_logs_exports = ["postgresql"]
  monitoring_interval             = 60
  monitoring_role_arn            = aws_iam_role.rds_enhanced_monitoring.arn

  deletion_protection = var.environment == "prod" ? true : false
  skip_final_snapshot = var.environment != "prod"

  performance_insights_enabled = true
  create_random_password = true

  tags = local.tags
}

# ElastiCache Redis
module "redis" {
  source = "./modules/redis"

  cluster_id           = "${local.name}-redis"
  description          = "Redis cluster for AI Schedule Manager"
  node_type           = var.redis_node_type
  port                = 6379
  parameter_group_name = "default.redis7"

  num_cache_nodes = var.redis_num_cache_nodes

  subnet_group_name  = module.vpc.elasticache_subnet_group_name
  security_group_ids = [module.security_groups.redis_security_group_id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token_enabled         = true

  snapshot_retention_limit = 5
  snapshot_window         = "03:00-05:00"

  tags = local.tags
}

# Security Groups
module "security_groups" {
  source = "./modules/security-groups"

  name   = local.name
  vpc_id = module.vpc.vpc_id

  tags = local.tags
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  name = local.name

  vpc_id     = module.vpc.vpc_id
  subnets    = module.vpc.public_subnets

  security_groups = [module.security_groups.alb_security_group_id]

  enable_deletion_protection = var.environment == "prod" ? true : false

  tags = local.tags
}

# S3 Buckets
module "s3" {
  source = "./modules/s3"

  bucket_name = "${local.name}-storage"
  environment = var.environment

  tags = local.tags
}

# CloudWatch and Monitoring
module "monitoring" {
  source = "./modules/monitoring"

  cluster_name = module.eks.cluster_name
  environment  = var.environment

  tags = local.tags
}

# IAM Roles and Policies
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name_prefix        = "${local.name}-rds-monitoring-"
  assume_role_policy = data.aws_iam_policy_document.rds_enhanced_monitoring.json

  tags = local.tags
}

data "aws_iam_policy_document" "rds_enhanced_monitoring" {
  statement {
    actions = [
      "sts:AssumeRole",
    ]

    principals {
      type        = "Service"
      identifiers = ["monitoring.rds.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Kubernetes Add-ons
resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  namespace  = "kube-system"

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }

  set {
    name  = "serviceAccount.create"
    value = "false"
  }

  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }

  depends_on = [module.eks]
}

resource "helm_release" "cluster_autoscaler" {
  name       = "cluster-autoscaler"
  repository = "https://kubernetes.github.io/autoscaler"
  chart      = "cluster-autoscaler"
  namespace  = "kube-system"

  set {
    name  = "autoDiscovery.clusterName"
    value = module.eks.cluster_name
  }

  set {
    name  = "awsRegion"
    value = var.aws_region
  }

  depends_on = [module.eks]
}

resource "helm_release" "cert_manager" {
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  namespace  = "cert-manager"
  version    = "v1.13.0"

  create_namespace = true

  set {
    name  = "installCRDs"
    value = "true"
  }

  depends_on = [module.eks]
}