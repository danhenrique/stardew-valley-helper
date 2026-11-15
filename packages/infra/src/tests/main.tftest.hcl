# Plan-only tests with mocked providers: no AWS credentials or state needed.
mock_provider "aws" {
  mock_data "aws_route53_zone" {
    defaults = {
      zone_id = "ZTEST123"
      name    = "danhenrique.com.br"
    }
  }
  mock_data "aws_region" {
    defaults = {
      id     = "sa-east-1"
      region = "sa-east-1"
    }
  }
}
mock_provider "aws" {
  alias = "us_east_1"
}
mock_provider "null" {}
mock_provider "local" {}
mock_provider "archive" {}
mock_provider "random" {}
mock_provider "terraform" {}

override_resource {
  target          = aws_acm_certificate.website
  override_during = plan
  values = {
    arn = "arn:aws:acm:us-east-1:000000000000:certificate/test"
    domain_validation_options = [
      {
        domain_name           = "stardew.danhenrique.com.br"
        resource_record_name  = "_test.stardew.danhenrique.com.br."
        resource_record_type  = "CNAME"
        resource_record_value = "_test.acm-validations.aws."
      },
      {
        # ACM returns the same validation record for the apex and its wildcard
        domain_name           = "*.stardew.danhenrique.com.br"
        resource_record_name  = "_test.stardew.danhenrique.com.br."
        resource_record_type  = "CNAME"
        resource_record_value = "_test.acm-validations.aws."
      },
    ]
  }
}

variables {
  environment = "prod"
  domain_name = "danhenrique.com.br"
}

run "should_serve_website_on_stardew_subdomain_when_planning_prod" {
  command = plan

  assert {
    condition     = local.website_domain == "stardew.danhenrique.com.br"
    error_message = "website must be served on stardew.<domain>"
  }
  assert {
    condition     = aws_acm_certificate.website.domain_name == "stardew.danhenrique.com.br"
    error_message = "certificate must cover the stardew subdomain"
  }
  assert {
    condition     = aws_route53_record.website_alias["A"].name == "stardew.danhenrique.com.br" && aws_route53_record.website_alias["AAAA"].type == "AAAA"
    error_message = "A and AAAA alias records are required"
  }
  assert {
    condition     = aws_route53_record.website_alias["A"].zone_id == "ZTEST123"
    error_message = "records must go into the existing hosted zone (data source)"
  }
}

run "should_keep_costs_minimal_when_planning_prod" {
  command = plan

  assert {
    condition     = local.cost_settings.waf == false && local.cost_settings.table_encryption == "DEFAULT" && local.cost_settings.website_encryption == "S3_MANAGED"
    error_message = "WAF off and AWS-owned/S3-managed encryption keep the stack at the lowest cost"
  }
}

run "should_serve_cognito_login_on_auth_subdomain_when_planning_prod" {
  command = plan

  assert {
    condition     = toset(aws_acm_certificate.website.subject_alternative_names) == toset(["*.stardew.danhenrique.com.br"])
    error_message = "the website certificate must also cover *.stardew.<domain> so the Cognito domain can reuse it"
  }
  assert {
    condition     = length(aws_route53_record.website_certificate_validation) == 1
    error_message = "apex and wildcard share one validation record; it must be created once"
  }
  assert {
    condition     = aws_cognito_user_pool_domain.auth.domain == "auth.stardew.danhenrique.com.br" && aws_cognito_user_pool_domain.auth.managed_login_version == 2
    error_message = "Cognito managed login must use auth.stardew.<domain>"
  }
  assert {
    condition     = aws_route53_record.auth_alias["A"].name == "auth.stardew.danhenrique.com.br" && aws_route53_record.auth_alias["AAAA"].type == "AAAA"
    error_message = "A and AAAA alias records are required for the auth subdomain"
  }
  assert {
    condition     = aws_route53_record.auth_alias["A"].zone_id == "ZTEST123"
    error_message = "auth records must go into the existing hosted zone (data source)"
  }
}

# Physical names inherited from aws-danhenrique. Renaming any of them replaces a live resource
# (the table holds player data and has deletion protection).
run "should_keep_aws_danhenrique_physical_names_when_planning_prod" {
  command = plan

  override_resource {
    target          = module.table.random_string.suffix
    override_during = plan
    values = {
      result = "abc123"
    }
  }
  override_resource {
    target          = module.user_identity.module.identity.random_id.unique_suffix
    override_during = plan
    values = {
      hex = "beef"
    }
  }
  override_data {
    target          = module.user_identity.module.identity.data.aws_caller_identity.current
    override_during = plan
    values = {
      account_id = "test-account"
    }
  }
  override_resource {
    target          = module.website.module.static_website.random_id.bucket_suffix
    override_during = plan
    values = {
      hex = "cafe"
    }
  }

  assert {
    condition     = module.table.table_name == "aws-danhenrique-stardew-valley-db-abc123"
    error_message = "the table name must stay aws-danhenrique-stardew-valley-db-<suffix>"
  }
  assert {
    condition     = module.user_identity.user_pool_domain == "danhenrique-stardew-valley-helper-website-test-account-beef"
    error_message = "the Cognito domain prefix must stay danhenrique-stardew-valley-helper-website"
  }
  assert {
    condition     = module.website.website_bucket_name == "stardew-helper-website-cafe"
    error_message = "the website name must stay stardew-helper (it names the website buckets)"
  }
}

# projects/.claude/rules/terraform.md: every resource carries ManagedBy and Repository. Both AWS
# providers apply local.default_tags as default_tags.
run "should_tag_every_resource_with_managed_by_and_repository_when_planning_prod" {
  command = plan

  assert {
    condition     = local.default_tags == { ManagedBy = "terraform", Repository = "danhenrique/stardew-valley-helper" }
    error_message = "default tags must be ManagedBy=terraform and Repository=danhenrique/stardew-valley-helper"
  }
}
