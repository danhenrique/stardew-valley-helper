terraform {
  required_version = ">= 1.7" # `removed` blocks

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "6.73.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "2.9.1"
    }
    null = {
      source  = "hashicorp/null"
      version = "3.3.2"
    }
  }
}

variable "application_id" {
  description = "AppConfig application ID (from `core/runtime-config/appconfig.application_id`)."
  type        = string
}

variable "environment_id" {
  description = "AppConfig environment ID (from `core/runtime-config/appconfig.environment_id`)."
  type        = string
}

variable "deployment_strategy_id" {
  description = "AppConfig deployment strategy ID (from `core/runtime-config/appconfig.deployment_strategy_id`)."
  type        = string
}

variable "configuration_profile_ids" {
  description = "Map of namespace to Configuration Profile ID (from `core/runtime-config/appconfig.configuration_profile_ids`)."
  type        = map(string)
}

variable "namespaces" {
  description = "List of namespaces to aggregate + deploy. Must match the keys of `configuration_profile_ids`."
  type        = list(string)
  default     = ["connection", "agentcore", "database", "dynamodb"]
}

locals {
  config_dir  = "${path.module}/../../../../../../../dist/packages/common/terraform/runtime-config"
  entries_dir = "${local.config_dir}/entries"
}

# LOCAL DIVERGENCE from the @aws/nx-plugin template (kept as of plugin 1.11.0):
# the template creates a new hosted configuration version and a deployment for
# every namespace on every apply, even when nothing changed. Each deployment makes
# every warm Lambda download the configuration again, which AppConfig bills.
# `publish.py` aggregates the entries (same logic as the template) and only
# creates a version + deployment when the content differs from what is deployed.
#
# Runs on every apply so entries written earlier in the same apply are picked up.
resource "terraform_data" "publish_namespace" {
  for_each = toset(var.namespaces)

  triggers_replace = {
    namespace = each.key
    always    = timestamp()
  }

  provisioner "local-exec" {
    command = "uv run python ${abspath(path.module)}/publish.py"
    environment = {
      NAMESPACE                = each.key
      ENTRIES_DIR              = local.entries_dir
      CONFIG_DIR               = local.config_dir
      APPLICATION_ID           = var.application_id
      ENVIRONMENT_ID           = var.environment_id
      CONFIGURATION_PROFILE_ID = var.configuration_profile_ids[each.key]
      DEPLOYMENT_STRATEGY_ID   = var.deployment_strategy_id
      AWS_REGION               = data.aws_region.current.region
    }
  }
}

data "aws_region" "current" {}

# Previously managed by the template. Forget them without deleting: the
# currently deployed hosted versions must stay in AppConfig.
removed {
  from = null_resource.aggregate_namespace
  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_appconfig_hosted_configuration_version.namespace
  lifecycle {
    destroy = false
  }
}

removed {
  from = aws_appconfig_deployment.namespace
  lifecycle {
    destroy = false
  }
}
