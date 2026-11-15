locals {
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
  }
}
