resource "aws_s3_bucket" "assets" {
  bucket = "acme-shop-assets"
}

resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
  }
}

module "network" {
  source = "terraform-aws-modules/vpc/aws"
}
