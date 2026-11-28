locals {
  # Required on every resource (projects/.claude/rules/terraform.md). Applied as default_tags by
  # both AWS providers, so it must stay static (a provider cannot depend on data sources).
  default_tags = {
    ManagedBy  = "terraform"
    Repository = "danhenrique/stardew-valley-helper"
  }

  account_id     = data.aws_caller_identity.current.account_id
  aws_region     = data.aws_region.current.region
  website_domain = "stardew.${var.domain_name}"
  website_origin = "https://${local.website_domain}"
  auth_domain    = "auth.${local.website_domain}"

  # "o mais barato possível": no WAF anywhere, AWS-owned / S3-managed encryption instead of
  # customer-managed KMS keys. See checkov.yml for the matching skips.
  cost_settings = {
    waf                = false
    table_encryption   = "DEFAULT"
    website_encryption = "S3_MANAGED"
    access_logs_kms    = false
    # Lambda logs are only used for debugging; keep a month instead of forever
    lambda_log_retention_days = 30
  }
}
