import type {ProjectNode} from '../model';

/**
 * Technology catalogue for the repository scanner: which package, container image or Terraform resource type means
 * which external system. Labels are generic product names; no vendor artwork is implied (see the icon registry).
 */
export type Tech={key:string;label:string;kind:ProjectNode['kind'];provider:string};
const t=(key:string,label:string,kind:ProjectNode['kind'],provider='Generic'):Tech=>({key,label,kind,provider});

export const TECHS={
 postgresql:t('postgresql','PostgreSQL','storage','PostgreSQL'),mysql:t('mysql','MySQL','storage'),sqlserver:t('sqlserver','SQL Server','storage','Azure'),
 sqlite:t('sqlite','SQLite','storage'),mongodb:t('mongodb','MongoDB','storage'),redis:t('redis','Redis','storage'),elasticsearch:t('elasticsearch','Elasticsearch','storage'),
 cassandra:t('cassandra','Cassandra','storage'),neo4j:t('neo4j','Neo4j','storage'),clickhouse:t('clickhouse','ClickHouse','storage'),snowflake:t('snowflake','Snowflake','storage','Snowflake'),
 bigquery:t('bigquery','BigQuery','storage','Google Cloud'),dynamodb:t('dynamodb','DynamoDB','storage','AWS'),s3:t('s3','Amazon S3','storage','AWS'),
 azureblob:t('azureblob','Azure Blob Storage','storage','Azure'),cosmosdb:t('cosmosdb','Azure Cosmos DB','storage','Azure'),gcs:t('gcs','Cloud Storage','storage','Google Cloud'),
 firestore:t('firestore','Firestore','storage','Google Cloud'),supabase:t('supabase','Supabase','storage'),
 kafka:t('kafka','Kafka','process','Kafka'),rabbitmq:t('rabbitmq','RabbitMQ','process'),nats:t('nats','NATS','process'),sqs:t('sqs','Amazon SQS','process','AWS'),
 sns:t('sns','Amazon SNS','process','AWS'),eventhubs:t('eventhubs','Azure Event Hubs','process','Azure'),servicebus:t('servicebus','Azure Service Bus','process','Azure'),
 pubsub:t('pubsub','Pub/Sub','process','Google Cloud'),
 stripe:t('stripe','Stripe API','source'),openai:t('openai','OpenAI API','model'),anthropic:t('anthropic','Anthropic API','model'),
 sendgrid:t('sendgrid','SendGrid','source'),twilio:t('twilio','Twilio','source'),auth0:t('auth0','Auth0','control'),entra:t('entra','Microsoft Entra ID','control','Azure'),
 cognito:t('cognito','Amazon Cognito','control','AWS'),keyvault:t('keyvault','Azure Key Vault','control','Azure'),secretsmanager:t('secretsmanager','AWS Secrets Manager','control','AWS'),
 sentry:t('sentry','Sentry','control'),datadog:t('datadog','Datadog','control'),appinsights:t('appinsights','Application Insights','control','Azure'),
 spark:t('spark','Apache Spark','process','Databricks'),databricks:t('databricks','Databricks','process','Databricks'),airflow:t('airflow','Airflow','process'),
 dbt:t('dbt','dbt','process'),lambda:t('lambda','AWS Lambda','function','AWS'),
} satisfies Record<string,Tech>;
export type TechKey=keyof typeof TECHS;

/** npm / PyPI / Go module names → technology. Checked against the exact package name, first match wins. */
export const PACKAGE_TECH:[RegExp,TechKey][]=[
 [/^(pg|postgres|pg-promise|psycopg2?(-binary)?|psycopg|asyncpg|@neondatabase\/serverless|github\.com\/jackc\/pgx.*|github\.com\/lib\/pq)$/i,'postgresql'],
 [/^(mysql2?|pymysql|mysqlclient|github\.com\/go-sql-driver\/mysql)$/i,'mysql'],[/^(mssql|tedious|pyodbc|pymssql)$/i,'sqlserver'],
 [/^(sqlite3|better-sqlite3)$/i,'sqlite'],[/^(mongodb|mongoose|pymongo|motor|go\.mongodb\.org\/mongo-driver)$/i,'mongodb'],
 [/^(redis|ioredis|@upstash\/redis|aioredis|github\.com\/redis\/go-redis.*)$/i,'redis'],[/^(@elastic\/elasticsearch|elasticsearch)$/i,'elasticsearch'],
 [/^(cassandra-driver)$/i,'cassandra'],[/^(neo4j-driver|neo4j)$/i,'neo4j'],[/^(@clickhouse\/client|clickhouse-connect)$/i,'clickhouse'],
 [/^(snowflake-sdk|snowflake-connector-python)$/i,'snowflake'],[/^(@google-cloud\/bigquery|google-cloud-bigquery)$/i,'bigquery'],
 [/^(@aws-sdk\/client-dynamodb|@aws-sdk\/lib-dynamodb)$/i,'dynamodb'],[/^(@aws-sdk\/client-s3)$/i,'s3'],
 [/^(@azure\/storage-blob|azure-storage-blob)$/i,'azureblob'],[/^(@azure\/cosmos|azure-cosmos)$/i,'cosmosdb'],
 [/^(@google-cloud\/storage|google-cloud-storage)$/i,'gcs'],[/^(@google-cloud\/firestore|google-cloud-firestore|firebase-admin)$/i,'firestore'],
 [/^(@supabase\/supabase-js|supabase)$/i,'supabase'],
 [/^(kafkajs|kafka-python|confluent-kafka|@confluentinc\/kafka-javascript|github\.com\/segmentio\/kafka-go)$/i,'kafka'],[/^(amqplib|pika|aio-pika)$/i,'rabbitmq'],[/^(nats)$/i,'nats'],
 [/^(@aws-sdk\/client-sqs)$/i,'sqs'],[/^(@aws-sdk\/client-sns)$/i,'sns'],[/^(@azure\/event-hubs|azure-eventhub)$/i,'eventhubs'],
 [/^(@azure\/service-bus|azure-servicebus)$/i,'servicebus'],[/^(@google-cloud\/pubsub|google-cloud-pubsub)$/i,'pubsub'],
 [/^(stripe)$/i,'stripe'],[/^(openai)$/i,'openai'],[/^(@anthropic-ai\/sdk|anthropic)$/i,'anthropic'],[/^(@sendgrid\/mail|sendgrid)$/i,'sendgrid'],[/^(twilio)$/i,'twilio'],
 [/^(auth0|@auth0\/.+)$/i,'auth0'],[/^(@azure\/msal-.+|msal|@azure\/identity|azure-identity)$/i,'entra'],[/^(@aws-sdk\/client-cognito-identity-provider)$/i,'cognito'],
 [/^(@azure\/keyvault-secrets|azure-keyvault-secrets)$/i,'keyvault'],[/^(@aws-sdk\/client-secrets-manager)$/i,'secretsmanager'],
 [/^(@sentry\/.+|sentry-sdk)$/i,'sentry'],[/^(dd-trace|ddtrace)$/i,'datadog'],[/^(applicationinsights|@azure\/monitor-opentelemetry|azure-monitor-opentelemetry)$/i,'appinsights'],
 [/^(pyspark)$/i,'spark'],[/^(databricks-sdk|databricks-sql-connector|databricks-connect)$/i,'databricks'],[/^(apache-airflow)$/i,'airflow'],[/^(dbt-core|dbt-.+)$/i,'dbt'],
];
export const techOfPackage=(name:string):TechKey|undefined=>PACKAGE_TECH.find(([re])=>re.test(name))?.[1];

/** Frameworks that tell what a code container is (web front end, API, worker), never an external system. */
export const FRAMEWORK_KIND:[RegExp,ProjectNode['kind'],string][]=[
 [/^(react|react-dom|vue|svelte|@angular\/core|solid-js|preact)$/i,'app','Web front end'],[/^(next|nuxt|@remix-run\/.+|astro|@sveltejs\/kit)$/i,'app','Web application'],
 [/^(express|fastify|koa|hapi|@hapi\/hapi|@nestjs\/core|hono|fastapi|flask|django|starlette|aiohttp|github\.com\/gin-gonic\/gin|github\.com\/labstack\/echo.*)$/i,'process','API service'],
 [/^(bullmq|bull|celery|rq|dramatiq)$/i,'function','Background worker'],[/^(electron)$/i,'app','Desktop application'],[/^(react-native|expo)$/i,'app','Mobile application'],
 [/^(@azure\/functions|azure-functions|aws-lambda|@types\/aws-lambda|functions-framework|@google-cloud\/functions-framework)$/i,'function','Serverless functions'],
 [/^(vscode|@types\/vscode)$/i,'app','VS Code extension'],
];

/** Container image names (docker-compose, Kubernetes) → technology. */
export const IMAGE_TECH:[RegExp,TechKey][]=[
 [/(^|\/)postgres|postgis|timescale/i,'postgresql'],[/(^|\/)(mysql|mariadb)/i,'mysql'],[/mssql|sql-server|azure-sql-edge/i,'sqlserver'],[/(^|\/)mongo/i,'mongodb'],
 [/(^|\/)(redis|valkey|keydb)/i,'redis'],[/elasticsearch|opensearch/i,'elasticsearch'],[/(^|\/)cassandra/i,'cassandra'],[/(^|\/)neo4j/i,'neo4j'],[/clickhouse/i,'clickhouse'],
 [/kafka|redpanda/i,'kafka'],[/rabbitmq/i,'rabbitmq'],[/(^|\/)nats/i,'nats'],[/localstack/i,'s3'],[/azurite/i,'azureblob'],[/airflow/i,'airflow'],
];

/** Terraform resource type prefixes → provider name for grouping. */
export const TERRAFORM_PROVIDER:[RegExp,string][]=[[/^aws_/,'AWS'],[/^azurerm_|^azuread_|^azapi_/,'Azure'],[/^google_/,'Google Cloud'],[/^kubernetes_|^helm_/,'Kubernetes'],[/^databricks_/,'Databricks'],[/^snowflake_/,'Snowflake'],[/^cloudflare_/,'Cloudflare'],[/^vercel_/,'Vercel']];
export function terraformKind(type:string):ProjectNode['kind']{
 if(/bucket|storage|database|db_|_db|sql|table|cosmos|dynamodb|redis|cache|disk|volume|s3_|blob|bigquery|datalake|warehouse/i.test(type))return 'storage';
 if(/lambda|function/i.test(type))return 'function';
 if(/iam|role|policy|key_vault|kms|secret|firewall|security_group|waf|identity|certificate|dns|vpc|subnet|network|nsg|gateway|route/i.test(type))return 'control';
 if(/queue|topic|sqs|sns|eventhub|servicebus|pubsub|kinesis|stream/i.test(type))return 'process';
 if(/web_app|app_service|static_site|cloudfront|cdn|frontdoor|app_engine|cloud_run|container_app|ecs|eks|aks|kubernetes|instance|vm|compute/i.test(type))return 'app';
 return 'process';
}

/** GitHub Actions `uses:` → where a workflow deploys or publishes. */
export const DEPLOY_ACTIONS:[RegExp,string,string][]=[
 [/^azure\/(webapps-deploy|functions-action|static-web-apps-deploy|aks-set-context|k8s-deploy|container-apps-deploy-action)/i,'Azure','Azure'],
 [/^aws-actions\/(amazon-ecs-deploy|configure-aws-credentials|amazon-ecr-login|aws-cloudformation)/i,'AWS','AWS'],
 [/^google-github-actions\/(deploy-cloudrun|deploy-appengine|auth|get-gke-credentials)/i,'Google Cloud','Google Cloud'],
 [/^(amondnet\/vercel-action|vercel\/)/i,'Vercel','Generic'],[/^cloudflare\/(wrangler-action|pages-action)/i,'Cloudflare','Generic'],
 [/^docker\/(build-push-action|login-action)/i,'Container registry','Generic'],[/^peaceiris\/actions-gh-pages|^actions\/deploy-pages/i,'GitHub Pages','Generic'],
 [/^hashicorp\/setup-terraform/i,'Terraform apply','Generic'],
];
