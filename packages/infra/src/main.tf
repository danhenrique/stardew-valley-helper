# Include metrics tracking for @aws/nx-plugin usage
module "metrics" {
  source = "../../common/terraform/src/metrics"
}

# Existing public hosted zone, managed by packages/infra. Read only.
data "aws_route53_zone" "main" {
  name = var.domain_name
}

# Certificate for the website domain and its subdomains (CloudFront requires us-east-1).
# The wildcard lets the Cognito managed login (auth.<website_domain>) reuse it.
resource "aws_acm_certificate" "website" {
  provider = aws.us_east_1

  domain_name               = local.website_domain
  subject_alternative_names = ["*.${local.website_domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "website_certificate_validation" {
  for_each = {
    # The wildcard shares the apex validation record, so it is skipped
    for dvo in aws_acm_certificate.website.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    } if !startswith(dvo.domain_name, "*.")
  }

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "website" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.website.arn
  validation_record_fqdns = [for record in aws_route53_record.website_certificate_validation : record.fqdn]
}

# Runtime configuration (AppConfig): API URL, Cognito settings, table name
module "runtime_config_appconfig" {
  source = "../../common/terraform/src/core/runtime-config/appconfig"

  application_name = "stardew-valley-helper-runtime-config"
}

module "asset_bucket" {
  source = "../../common/terraform/src/core/asset-bucket"

  bucket_name_prefix = "stardew-valley-assets"
}

module "table" {
  source = "../../common/terraform/src/app/dynamodb/stardew-valley-db"

  deletion_protection_enabled = true
  encryption                  = local.cost_settings.table_encryption
}

module "user_identity" {
  source = "../../common/terraform/src/core/user-identity"

  enable_waf            = local.cost_settings.waf
  mfa                   = "OPTIONAL"
  mfa_second_factor_sms = false
  mfa_second_factor_otp = true
  callback_urls         = [local.website_origin]
  logout_urls           = [local.website_origin]

  managed_login_domain = local.auth_domain
}

module "api" {
  source = "../../common/terraform/src/app/apis/stardew-valley-api"

  asset_bucket_name            = module.asset_bucket.bucket_name
  appconfig_application_id     = module.runtime_config_appconfig.application_id
  appconfig_application_arn    = module.runtime_config_appconfig.application_arn
  enable_waf                   = local.cost_settings.waf
  encrypt_access_logs_with_kms = local.cost_settings.access_logs_kms

  env = {
    ALLOWED_ORIGINS = local.website_origin
    LOG_LEVEL       = "INFO"
  }

  # Every operation reads and writes the single table
  additional_iam_policy_statements = concat(
    [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
        ]
        Resource = [module.table.table_arn, "${module.table.table_arn}/index/*"]
      },
    ],
    module.table.kms_key_arn == null ? [] : [
      {
        Effect   = "Allow"
        Action   = ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:DescribeKey"]
        Resource = [module.table.kms_key_arn]
      },
    ],
  )
}

# Signed-in players may invoke the API with their Identity Pool credentials
resource "aws_iam_role_policy" "authenticated_api_invoke" {
  name = "stardew-valley-authenticated-api-invoke"
  role = module.user_identity.authenticated_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["execute-api:Invoke"]
        Resource = ["${module.api.api_execution_arn}/*"]
      },
    ]
  })
}

module "website" {
  source = "../../common/terraform/src/app/static-websites/stardew-valley-helper-website"

  providers = {
    aws.us_east_1 = aws.us_east_1
  }

  custom_domain_names = [local.website_domain]
  acm_certificate_arn = aws_acm_certificate_validation.website.certificate_arn
  enable_waf          = local.cost_settings.waf
  encryption          = local.cost_settings.website_encryption

  # runtime-config.json must contain the API URL and Cognito settings
  depends_on = [module.api, module.user_identity]
}

resource "aws_route53_record" "website_alias" {
  for_each = toset(["A", "AAAA"])

  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.website_domain
  type    = each.key

  alias {
    name                   = module.website.cloudfront_domain_name
    zone_id                = "Z2FDTNDATAQYW2" # CloudFront hosted zone id (global constant)
    evaluate_target_health = false
  }
}

# Managed login on our own domain instead of *.amazoncognito.com, next to the prefix domain
# (a user pool allows one of each). Cognito requires the parent domain to resolve first:
# referencing the website alias record orders it after that record.
resource "aws_cognito_user_pool_domain" "auth" {
  domain                = "auth.${aws_route53_record.website_alias["A"].name}"
  certificate_arn       = aws_acm_certificate_validation.website.certificate_arn
  user_pool_id          = module.user_identity.user_pool_id
  managed_login_version = 2
}

resource "aws_route53_record" "auth_alias" {
  for_each = toset(["A", "AAAA"])

  zone_id = data.aws_route53_zone.main.zone_id
  name    = aws_cognito_user_pool_domain.auth.domain
  type    = each.key

  alias {
    name                   = aws_cognito_user_pool_domain.auth.cloudfront_distribution
    zone_id                = aws_cognito_user_pool_domain.auth.cloudfront_distribution_zone_id
    evaluate_target_health = false
  }
}

# Must be last: publishes every runtime-config entry to AppConfig
module "runtime_config_appconfig_deployment" {
  source = "../../common/terraform/src/core/runtime-config/appconfig-deployment"

  application_id            = module.runtime_config_appconfig.application_id
  environment_id            = module.runtime_config_appconfig.environment_id
  deployment_strategy_id    = module.runtime_config_appconfig.deployment_strategy_id
  configuration_profile_ids = module.runtime_config_appconfig.configuration_profile_ids
  namespaces                = module.runtime_config_appconfig.namespaces

  depends_on = [module.table, module.user_identity, module.api, module.website]
}
