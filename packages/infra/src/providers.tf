terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.73.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "3.3.2"
    }
    local = {
      source  = "hashicorp/local"
      version = "2.9.1"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "2.8.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.9.1"
    }
  }

  backend "s3" {
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.default_tags
  }
}

# CloudFront only accepts ACM certificates from us-east-1
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.default_tags
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
