variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "sa-east-1"
}

variable "environment" {
  description = "Environment name (only prod for now)"
  type        = string
}

variable "domain_name" {
  description = "Existing Route 53 hosted zone; the website is served at stardew.<domain_name>"
  type        = string
}
