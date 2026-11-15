output "website_url" {
  description = "Public website URL"
  value       = local.website_origin
}

output "cloudfront_url" {
  description = "Default CloudFront URL of the website"
  value       = module.website.website_url
}

output "api_url" {
  description = "API stage invoke URL"
  value       = module.api.stage_invoke_url
}

output "table_name" {
  description = "DynamoDB table name"
  value       = module.table.table_name
}

output "runtime_config_app_id" {
  description = "AppConfig application id (RUNTIME_CONFIG_APP_ID for the import)"
  value       = module.runtime_config_appconfig.application_id
}

output "user_pool_id" {
  description = "Cognito user pool id"
  value       = module.user_identity.user_pool_id
}
