import type {Project} from '../core/model';
import {block,node,note,project,validateDocument,view} from './builders';

/*
 * Cloud architecture gallery: independently authored teaching references, one per platform. Each one is a starting
 * point to explain or adapt, not a vendor-approved drawing: components use the generic symbols (no vendor artwork
 * without its own terms review, see src/core/icons.ts), each cites the official guidance it is based on, and every
 * code sample and table row is labelled synthetic.
 */
const REFERENCE_NOTE='Independently authored teaching reference based on the cited official guidance. Not a vendor-approved architecture; sizing, security and cost need project-specific decisions.';

function awsServerless():Project{
 const d=project('aws-serverless-web','AWS serverless web application','A static front end, a managed API and functions over a key-value table: request path, identity, idempotency and observability.','Reference',['AWS','Serverless','Web','Cloud architecture']);
 d.provenance=REFERENCE_NOTE;
 d.sources=[{id:'aws-serverless-lens',title:'AWS Well-Architected Serverless Applications Lens',url:'https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html',location:'Pillars and scenarios for serverless workloads; this diagram is an independent illustration.',visibility:'public'},
  {id:'aws-lambda-guide',title:'AWS Lambda developer guide',url:'https://docs.aws.amazon.com/lambda/latest/dg/welcome.html',location:'Function concepts, invocation and scaling.',visibility:'public'},
  {id:'aws-idempotency',title:'Powertools for AWS Lambda: idempotency',url:'https://docs.aws.amazon.com/powertools/python/latest/utilities/idempotency/',location:'Idempotency records keyed by a request hash.',visibility:'public'}];
 node(d,'users','Browser and mobile users','source',{summary:'Sign in, then call the API over HTTPS'});
 node(d,'cdn','Amazon CloudFront','app',{provider:'AWS',summary:'Caches the static site at the edge'});
 node(d,'site','Static site bucket','storage',{provider:'AWS',summary:'Amazon S3, private, served through the CDN only'});
 node(d,'identity','Amazon Cognito','control',{provider:'AWS',summary:'User pool issues tokens for the API'});
 node(d,'api','Amazon API Gateway','process',{provider:'AWS',summary:'Validates tokens and requests, throttles',childViewId:'request-path',sourceIds:['aws-serverless-lens']});
 node(d,'orders-fn','Orders function','function',{provider:'AWS',summary:'AWS Lambda handler, one per route',sourceIds:['aws-lambda-guide']});
 node(d,'table','Orders table','storage',{provider:'AWS',summary:'Amazon DynamoDB, on-demand capacity'});
 node(d,'observe','Amazon CloudWatch','control',{provider:'AWS',summary:'Logs, metrics, alarms and traces'});
 view(d,'overview','AWS | serverless web application','The browser loads the static site from the CDN and calls the API with a token. Every arrow is a decision about identity, retries and limits, not just a connection.',
  ['users','cdn','site','identity','api','orders-fn','table','observe'],
  [['users','cdn','HTTPS'],['cdn','site','origin access'],['users','identity','sign in','control'],['users','api','API call + token','query'],['api','orders-fn','invoke'],['orders-fn','table','read / write'],['orders-fn','observe','logs, metrics','control']],4);
 node(d,'authorizer','Token check','control',{summary:'Reject expired or foreign tokens before any code runs'});
 node(d,'validate','Request validation','control',{summary:'Schema check at the edge of the API'});
 node(d,'idem','Idempotency record','function',{summary:'Same request key → same result, no double order',sourceIds:['aws-idempotency']});
 node(d,'write','Conditional write','storage',{summary:'Write only if the order does not exist yet'});
 view(d,'request-path','Inside one API request','A retried POST must not create two orders. The idempotency key and a conditional write make the retry safe.',['authorizer','validate','idem','write'],[['authorizer','validate','valid token'],['validate','idem','valid body'],['idem','write','first time only']],4);
 note(d,'idem','why-idempotency','Why the retry matters','Clients, API Gateway and Lambda can all retry. Without an idempotency key, a timeout after a successful write turns into a duplicate order. Store the key with the result and return the stored result for repeats.','reference',['aws-idempotency']);
 block(d,'write',{id:'conditional-put',title:'Conditional write (illustrative)',type:'code',language:'python',code:"table.put_item(\n    Item={'pk': f'ORDER#{order_id}', 'status': 'NEW', 'total': total},\n    ConditionExpression='attribute_not_exists(pk)',\n)",provenance:'synthetic'});
 block(d,'api',{id:'api-limits',title:'Decisions behind the API box',type:'table',columns:['Decision','Illustrative choice'],rows:[['Auth','Cognito user pool tokens'],['Throttling','Per-client usage plan'],['Validation','Request schema at the gateway'],['Timeouts','Below the client timeout']],provenance:'synthetic'});
 d.story=[{title:'From browser to table',viewId:'overview',nodeId:'api',narration:'The CDN serves the site; the API checks identity and limits before any function runs.',highlightEdgeIds:[]},
  {title:'Make retries safe',viewId:'request-path',nodeId:'idem',narration:'An idempotency record and a conditional write turn a retried request into the same single order.',highlightEdgeIds:[]}];
 return validateDocument(d);
}

function azureWebApp():Project{
 const d=project('azure-web-app-private-data','Azure web app with private data','A zone-redundant web app behind a global entry point, with secrets in Key Vault and the database reachable only through a private endpoint.','Reference',['Azure','Web','Private networking','Cloud architecture']);
 d.provenance=REFERENCE_NOTE;
 d.sources=[{id:'az-baseline',title:'Baseline highly available zone-redundant web application',url:'https://learn.microsoft.com/en-us/azure/architecture/web-apps/app-service/architectures/baseline-zone-redundant',location:'Azure Architecture Center reference; this diagram is an independent simplification.',visibility:'public'},
  {id:'az-private-endpoint',title:'What is a private endpoint?',url:'https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-overview',location:'Private IP access to platform services.',visibility:'public'}];
 node(d,'visitors','Visitors','source',{summary:'Public internet traffic'});
 node(d,'edge','Azure Front Door + WAF','control',{provider:'Azure',summary:'Global entry, TLS, web application firewall',sourceIds:['az-baseline']});
 node(d,'web','App Service','app',{provider:'Azure',summary:'Zone-redundant web app, VNet integrated',childViewId:'private-path'});
 node(d,'entra','Microsoft Entra ID','control',{provider:'Azure',summary:'User sign-in and managed identity'});
 node(d,'vault','Key Vault','control',{provider:'Azure',summary:'Secrets and certificates, read by managed identity'});
 node(d,'db','Azure SQL Database','storage',{provider:'Azure',summary:'Public access disabled'});
 node(d,'insights','Application Insights','report',{provider:'Azure',summary:'Requests, dependencies, failures'});
 view(d,'overview','Azure | web app with private data','Only the entry point is public. The app reads secrets with its managed identity and reaches the database over a private endpoint.',
  ['visitors','edge','web','entra','vault','db','insights'],
  [['visitors','edge','HTTPS'],['edge','web','origin (restricted)'],['web','entra','sign-in','control'],['web','vault','managed identity','control'],['web','db','private endpoint','query'],['web','insights','telemetry','control']],4);
 node(d,'vnet-int','VNet integration','control',{summary:'Outbound traffic from the app enters the virtual network'});
 node(d,'pe','Private endpoint','control',{summary:'A private IP for the database in its own subnet',sourceIds:['az-private-endpoint']});
 node(d,'dns','Private DNS zone','control',{summary:'The database name resolves to the private IP'});
 node(d,'sql-private','Azure SQL (private)','storage',{summary:'Accepts connections from the private endpoint only'});
 view(d,'private-path','How the app reaches the database privately','Name resolution is part of the design: without the private DNS zone, the app would resolve the public address and be refused.',['vnet-int','dns','pe','sql-private'],[['vnet-int','dns','resolve name'],['dns','pe','private IP'],['pe','sql-private','TDS over private link']],4);
 note(d,'dns','dns-matters','The usual failure','A private endpoint without the matching private DNS zone looks fine in the portal and fails at runtime: the connection string still resolves to the public endpoint, which is closed.','reference',['az-private-endpoint']);
 block(d,'web',{id:'web-settings',title:'Settings that make the diagram true',type:'table',columns:['Setting','Illustrative value'],rows:[['Zone redundancy','On, 3 instances minimum'],['Inbound access','Front Door only (access restriction)'],['Outbound','VNet integration, route all'],['Secrets','Key Vault references']],provenance:'synthetic'});
 d.story=[{title:'One public door',viewId:'overview',nodeId:'edge',narration:'Front Door and its firewall are the only public entry; the app accepts traffic from it alone.',highlightEdgeIds:[]},
  {title:'Private by name, not by hope',viewId:'private-path',nodeId:'dns',narration:'The private DNS zone is what sends the database connection over the private endpoint.',highlightEdgeIds:[]}];
 return validateDocument(d);
}

function gcpStreaming():Project{
 const d=project('gcp-streaming-analytics','Google Cloud streaming analytics','Events through Pub/Sub into a Dataflow streaming pipeline, landing in BigQuery for dashboards, with a dead-letter path for bad records.','Reference',['Google Cloud','Streaming','Analytics','Cloud architecture']);
 d.provenance=REFERENCE_NOTE;
 d.sources=[{id:'gcp-pubsub',title:'Pub/Sub overview',url:'https://cloud.google.com/pubsub/docs/overview',location:'Topics, subscriptions and delivery.',visibility:'public'},
  {id:'gcp-streaming',title:'Streaming pipelines (Dataflow)',url:'https://cloud.google.com/dataflow/docs/concepts/streaming-pipelines',location:'Windows, watermarks, triggers and late data.',visibility:'public'},
  {id:'gcp-write-api',title:'BigQuery Storage Write API',url:'https://cloud.google.com/bigquery/docs/write-api',location:'Streaming ingestion into BigQuery.',visibility:'public'}];
 node(d,'devices','Apps and devices','source',{summary:'Emit events with an event time and an ID'});
 node(d,'topic','Pub/Sub topic','process',{provider:'Google Cloud',summary:'Durable, at-least-once delivery',sourceIds:['gcp-pubsub']});
 node(d,'pipeline','Dataflow streaming job','process',{provider:'Google Cloud',summary:'Parse, deduplicate, window, enrich',childViewId:'pipeline-detail',sourceIds:['gcp-streaming']});
 node(d,'dlq','Dead-letter bucket','storage',{provider:'Google Cloud',summary:'Cloud Storage, unparseable records kept for replay'});
 node(d,'bq','BigQuery','storage',{provider:'Google Cloud',summary:'Partitioned event and aggregate tables',sourceIds:['gcp-write-api']});
 node(d,'dash','Looker Studio dashboard','report',{provider:'Google Cloud',summary:'Near-real-time KPIs'});
 view(d,'overview','Google Cloud | streaming analytics','Delivery is at least once, so the pipeline owns deduplication. Records that cannot be parsed go to a dead-letter path instead of stopping the job.',
  ['devices','topic','pipeline','dlq','bq','dash'],
  [['devices','topic','publish','stream'],['topic','pipeline','subscription','stream'],['pipeline','bq','Storage Write API','stream'],['pipeline','dlq','bad records'],['bq','dash','query','query']],3);
 node(d,'parse','Parse and validate','function',{summary:'Schema check; failures to the dead-letter output'});
 node(d,'dedupe','Deduplicate by event ID','function',{summary:'Redelivered messages must not count twice'});
 node(d,'window','Event-time windows','function',{summary:'1-minute windows, watermark, allowed lateness'});
 node(d,'aggregate','Aggregate and write','storage',{summary:'Per-window counts appended to BigQuery'});
 view(d,'pipeline-detail','Inside the streaming job','Windowing by event time, not arrival time, keeps late events in the right minute.',['parse','dedupe','window','aggregate'],[['parse','dedupe','valid events','stream'],['dedupe','window','unique events','stream'],['window','aggregate','closed windows','stream']],4);
 note(d,'window','late-data','Late data is a product decision','How long a window waits for late events trades freshness against completeness. State the allowed lateness next to the dashboard so readers know when a minute is final.','reference',['gcp-streaming']);
 block(d,'aggregate',{id:'window-rows',title:'Window output (synthetic rows)',type:'table',columns:['window_start','events','late_events','final'],rows:[['10:00','1204',3,true],['10:01','1187',0,true],['10:02','1240',12,false]],provenance:'synthetic'});
 d.story=[{title:'At least once means dedupe',viewId:'overview',nodeId:'pipeline',narration:'Pub/Sub may deliver a message twice; the pipeline, not the dashboard, removes duplicates.',highlightEdgeIds:[]},
  {title:'Event time decides the window',viewId:'pipeline-detail',nodeId:'window',narration:'Watermarks and allowed lateness say when a minute is final.',highlightEdgeIds:[]}];
 return validateDocument(d);
}

function kubernetesMicroservices():Project{
 const d=project('kubernetes-microservices','Microservices on Kubernetes','An ingress in front of independently deployed services, autoscaled pods, configuration and secrets, and the signals operators watch.','Reference',['Kubernetes','Microservices','Containers','Cloud architecture']);
 d.provenance=REFERENCE_NOTE;
 d.sources=[{id:'k8s-ingress',title:'Kubernetes Ingress',url:'https://kubernetes.io/docs/concepts/services-networking/ingress/',location:'HTTP routing into cluster services.',visibility:'public'},
  {id:'k8s-hpa',title:'Horizontal Pod Autoscaling',url:'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/',location:'Scaling replicas from metrics.',visibility:'public'}];
 node(d,'clients','Clients','source',{summary:'Web and partner API calls'});
 node(d,'ingress','Ingress controller','control',{provider:'Kubernetes',summary:'TLS termination and path routing',sourceIds:['k8s-ingress']});
 node(d,'catalog','Catalog service','app',{provider:'Kubernetes',summary:'Deployment + Service, read-heavy'});
 node(d,'orders','Orders service','app',{provider:'Kubernetes',summary:'Deployment + Service, autoscaled',childViewId:'scaling'});
 node(d,'config','ConfigMaps and Secrets','control',{provider:'Kubernetes',summary:'Mounted at start; secrets from an external store'});
 node(d,'orders-db','Orders database','storage',{summary:'Managed database outside the cluster'});
 node(d,'metrics','Metrics and logs','report',{summary:'Golden signals per service'});
 view(d,'overview','Kubernetes | microservices','Each service deploys and scales on its own. State lives outside the cluster; pods stay replaceable.',
  ['clients','ingress','catalog','orders','metrics','config','orders-db'],
  [['clients','ingress','HTTPS'],['ingress','catalog','/catalog'],['ingress','orders','/orders'],['config','orders','env + files','control'],['orders','orders-db','SQL','query'],['orders','metrics','metrics, logs','control'],['catalog','metrics','metrics, logs','control']],4);
 node(d,'hpa','HorizontalPodAutoscaler','control',{summary:'Targets average CPU or requests per pod',sourceIds:['k8s-hpa']});
 node(d,'replicas','Pod replicas','process',{summary:'2 to 10 pods, each stateless'});
 node(d,'probes','Readiness probe','control',{summary:'Traffic only to pods that are ready'});
 view(d,'scaling','How the orders service scales','Scaling only helps if new pods are ready before they receive traffic and the database can take the extra connections.',['hpa','replicas','probes'],[['hpa','replicas','scale out / in','control'],['probes','replicas','gate traffic','control']],3);
 block(d,'hpa',{id:'hpa-yaml',title:'Autoscaler (illustrative)',type:'code',language:'text',code:'apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata:\n  name: orders\nspec:\n  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: orders}\n  minReplicas: 2\n  maxReplicas: 10\n  metrics:\n    - type: Resource\n      resource: {name: cpu, target: {type: Utilization, averageUtilization: 70}}',provenance:'synthetic'});
 note(d,'replicas','connection-budget','The hidden limit','Ten pods with a pool of 20 connections each need 200 database connections. Check the database limit before raising maxReplicas.','author');
 d.story=[{title:'Route, then scale per service',viewId:'overview',nodeId:'ingress',narration:'The ingress routes by path; each service scales independently behind it.',highlightEdgeIds:[]},
  {title:'Ready before traffic',viewId:'scaling',nodeId:'probes',narration:'Readiness probes keep new pods out of rotation until they can serve.',highlightEdgeIds:[]}];
 return validateDocument(d);
}

function eventDrivenOutbox():Project{
 const d=project('event-driven-outbox','Event-driven orders with an outbox','A service saves the order and its event in one transaction; a relay publishes events to a broker; consumers process them idempotently, with a dead-letter queue. Cloud-agnostic.','Reference',['Event-driven','Messaging','Patterns','Cloud architecture']);
 d.provenance=REFERENCE_NOTE;
 d.sources=[{id:'outbox',title:'Pattern: Transactional outbox',url:'https://microservices.io/patterns/data/transactional-outbox.html',location:'Publishing events reliably with a local transaction.',visibility:'public'},
  {id:'competing-consumers',title:'Competing Consumers pattern',url:'https://learn.microsoft.com/en-us/azure/architecture/patterns/competing-consumers',location:'Several consumers on one queue.',visibility:'public'}];
 node(d,'order-api','Orders API','app',{summary:'Accepts the order'});
 node(d,'orders-store','Orders database','storage',{summary:'orders + outbox tables, one transaction',childViewId:'outbox-detail',sourceIds:['outbox']});
 node(d,'relay','Outbox relay','process',{summary:'Reads new outbox rows, publishes, marks sent'});
 node(d,'broker','Message broker','process',{summary:'Topic per event type; at-least-once delivery'});
 node(d,'billing','Billing consumer','function',{summary:'Idempotent: event ID already seen → skip',sourceIds:['competing-consumers']});
 node(d,'shipping','Shipping consumer','function',{summary:'Idempotent, independent retry policy'});
 node(d,'dead-letter','Dead-letter queue','storage',{summary:'Messages that failed every retry, kept for review'});
 view(d,'overview','Event-driven | transactional outbox','The order and its event commit together, so no event is lost and none is published for a rolled-back order.',
  ['order-api','orders-store','relay','broker','billing','shipping','dead-letter'],
  [['order-api','orders-store','insert order + event'],['orders-store','relay','poll new rows'],['relay','broker','publish','stream'],['broker','billing','OrderPlaced','stream'],['broker','shipping','OrderPlaced','stream'],['billing','dead-letter','after max retries'],['shipping','dead-letter','after max retries']],4);
 node(d,'tx','One transaction','control',{summary:'INSERT order; INSERT outbox event; COMMIT'});
 node(d,'outbox-table','outbox table','table',{summary:'event_id, type, payload, created_at, sent_at'});
 node(d,'mark-sent','Mark sent','function',{summary:'Only after the broker acknowledged'});
 view(d,'outbox-detail','Inside the outbox','If the relay crashes after publishing and before marking the row, the event is published again: consumers must be idempotent.',['tx','outbox-table','mark-sent'],[['tx','outbox-table','commit'],['outbox-table','mark-sent','after ack']],3);
 block(d,'tx',{id:'outbox-sql',title:'Order and event in one transaction (illustrative)',type:'code',language:'sql',code:"BEGIN;\nINSERT INTO orders (order_id, customer_id, total) VALUES ('o-1001', 'c-42', 120.00);\nINSERT INTO outbox (event_id, type, payload)\nVALUES ('e-9001', 'OrderPlaced', '{\"order_id\":\"o-1001\"}');\nCOMMIT;",provenance:'synthetic'});
 note(d,'billing','idempotent-consumer','Why consumers keep a processed-event table','The broker delivers at least once and the relay may republish after a crash. A consumer records each event ID it has handled, in the same transaction as its own change, and skips IDs it has already seen.','reference',['outbox','competing-consumers']);
 block(d,'outbox-table',{id:'outbox-rows',title:'Outbox rows (synthetic)',type:'table',columns:['event_id','type','sent_at'],rows:[['e-9001','OrderPlaced','10:00:02'],['e-9002','OrderPlaced',null]],provenance:'synthetic'});
 d.story=[{title:'No lost events, no ghost events',viewId:'overview',nodeId:'orders-store',narration:'The outbox row commits with the order; the relay publishes it afterwards.',highlightEdgeIds:[]},
  {title:'Duplicates are expected',viewId:'outbox-detail',nodeId:'mark-sent',narration:'A crash between publish and mark-sent republishes the event, so consumers skip IDs they have seen.',highlightEdgeIds:[]}];
 return validateDocument(d);
}

/** The cloud architecture gallery, in display order. */
export function cloudGallery():Project[]{return [awsServerless(),azureWebApp(),gcpStreaming(),kubernetesMicroservices(),eventDrivenOutbox()];}
