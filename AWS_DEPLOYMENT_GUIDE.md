# Deploying VMS to AWS - Complete Guide

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [AWS Services Needed](#aws-services-needed)
3. [Prerequisites](#prerequisites)
4. [Step-by-Step Deployment](#step-by-step-deployment)
5. [Database Setup](#database-setup)
6. [Deployment Options](#deployment-options)
7. [Monitoring & Scaling](#monitoring--scaling)
8. [Cost Estimation](#cost-estimation)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    AWS Cloud                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌────────────────┐      ┌────────────────┐           │
│  │   CloudFront   │      │   Route 53     │           │
│  │   (CDN)        │      │   (DNS)        │           │
│  └────────┬───────┘      └────────┬───────┘           │
│           │                       │                     │
│  ┌────────▼──────────────────────▼────────┐           │
│  │    Application Load Balancer (ALB)     │           │
│  │           (HTTPS/SSL)                  │           │
│  └────────┬──────────────────────┬────────┘           │
│           │                      │                     │
│  ┌────────▼──────┐    ┌──────────▼────────┐           │
│  │   ECS Cluster │    │   ECS Cluster    │           │
│  │  (Frontend)   │    │   (API)          │           │
│  │ - Port 3000   │    │ - Port 4000      │           │
│  └───────────────┘    └──────────────────┘           │
│           │                      │                     │
│  ┌────────▼──────────────────────▼────────┐           │
│  │    RDS PostgreSQL (Multi-AZ)           │           │
│  │    - pgvector extension                │           │
│  │    - Automated backups                 │           │
│  └────────────────────────────────────────┘           │
│                      │                                 │
│  ┌────────────────────▼────────────────┐              │
│  │  S3 Bucket                         │              │
│  │  - Photos/Storage                  │              │
│  │  - Backups                         │              │
│  └────────────────────────────────────┘              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## AWS Services Needed

### Essential Services
| Service | Purpose | Cost |
|---------|---------|------|
| **EC2** | Compute instances (or use ECS) | $10-50/month |
| **RDS PostgreSQL** | Managed database | $30-100/month |
| **ALB** | Load balancer | $20/month |
| **Route 53** | DNS | $0.50/month |
| **S3** | File storage | $1-5/month |
| **CloudFront** | CDN (optional) | Pay per GB |
| **ECR** | Docker registry | ~$0.10/GB |

### Optional Services
- **CloudWatch** - Monitoring & logs (included in free tier)
- **ElastiCache** - Redis cache for sessions
- **SES** - Email notifications
- **Secrets Manager** - Store API keys

---

## Prerequisites

### Before Starting
1. ✅ AWS Account with billing enabled
2. ✅ AWS CLI installed and configured
3. ✅ Docker installed locally
4. ✅ Domain name (optional, but recommended)
5. ✅ Basic AWS knowledge (VPC, Security Groups, IAM)

### Install AWS CLI
```bash
# Windows (using Chocolatey)
choco install awscli

# Or download from https://aws.amazon.com/cli/

# Verify installation
aws --version
```

### Configure AWS Credentials
```bash
aws configure
# Enter:
# AWS Access Key ID: [your-access-key]
# AWS Secret Access Key: [your-secret-key]
# Default region: us-east-1 (or your preferred region)
# Default output format: json
```

---

## Step-by-Step Deployment

### Option 1: Using ECS (Elastic Container Service) - RECOMMENDED

#### Step 1: Create ECR Repository

```bash
# Create repository for frontend
aws ecr create-repository \
  --repository-name vms-frontend \
  --region us-east-1

# Create repository for API
aws ecr create-repository \
  --repository-name vms-api \
  --region us-east-1
```

#### Step 2: Push Docker Images to ECR

```bash
# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=us-east-1

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Tag and push frontend
docker tag vms-frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/vms-frontend:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/vms-frontend:latest

# Tag and push API
docker tag vms-api:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/vms-api:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/vms-api:latest
```

#### Step 3: Create RDS PostgreSQL Database

```bash
# Create security group for RDS
aws ec2 create-security-group \
  --group-name vms-db-sg \
  --description "VMS Database Security Group" \
  --vpc-id vpc-xxxxx

# Allow inbound on port 5432 from your security group
aws ec2 authorize-security-group-ingress \
  --group-name vms-db-sg \
  --protocol tcp \
  --port 5432 \
  --source-security-group-id sg-xxxxx

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier vms-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.3 \
  --master-username admin \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 100 \
  --vpc-security-group-ids sg-xxxxx \
  --publicly-accessible false \
  --storage-encrypted \
  --multi-az \
  --backup-retention-period 30 \
  --enable-cloudwatch-logs-exports postgresql
```

#### Step 4: Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name vms-cluster

# Create task execution role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

# Attach policy
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

#### Step 5: Create Task Definitions

**Create task definition file: vms-api-task.json**
```json
{
  "family": "vms-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "vms-api",
      "image": "YOUR_AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/vms-api:latest",
      "portMappings": [
        {
          "containerPort": 4000,
          "hostPort": 4000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "4000"
        },
        {
          "name": "DATABASE_URL",
          "value": "postgresql://admin:password@vms-postgres.xxxxx.rds.amazonaws.com:5432/vms"
        },
        {
          "name": "FRONTEND_URL",
          "value": "https://yourdomain.com"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/vms-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "executionRoleArn": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:role/ecsTaskExecutionRole"
}
```

**Register task definition**
```bash
aws ecs register-task-definition \
  --cli-input-json file://vms-api-task.json
```

#### Step 6: Create Application Load Balancer

```bash
# Create target group for API
aws elbv2 create-target-group \
  --name vms-api-tg \
  --protocol HTTP \
  --port 4000 \
  --vpc-id vpc-xxxxx \
  --health-check-path /api/health

# Create target group for Frontend
aws elbv2 create-target-group \
  --name vms-frontend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxx \
  --health-check-path /
```

#### Step 7: Create ECS Services

```bash
aws ecs create-service \
  --cluster vms-cluster \
  --service-name vms-api \
  --task-definition vms-api:1 \
  --desired-count 2 \
  --launch-type FARGATE \
  --load-balancers targetGroupArn=arn:aws:elasticloadbalancing:us-east-1:...:targetgroup/vms-api-tg/...,containerName=vms-api,containerPort=4000 \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxx,subnet-xxxxx],securityGroups=[sg-xxxxx],assignPublicIp=ENABLED}"
```

---

## Database Setup

### Initialize PostgreSQL with pgvector

```bash
# Connect to RDS instance
psql -h vms-postgres.xxxxx.rds.amazonaws.com -U admin -d vms

# Create database
CREATE DATABASE vms;

# Install pgvector extension
CREATE EXTENSION vector;

# Run Prisma migrations
npx prisma db push --skip-generate
```

---

## Deployment Options

### Option 1: ECS on Fargate (RECOMMENDED)
- ✅ Serverless containers
- ✅ Auto-scaling
- ✅ No server management
- ❌ Slightly higher cost

### Option 2: EC2 with Docker Compose
- ✅ Lower cost
- ✅ Full control
- ❌ Need to manage servers
- ❌ Manual scaling

### Option 3: Elastic Beanstalk
- ✅ Easy deployment
- ✅ Auto-scaling built-in
- ❌ Less flexible

### Option 4: ECS + EC2
- ✅ Balance of cost and features
- ✅ Docker container management
- ❌ Need to manage some infrastructure

---

## Configure Domain & SSL

### Step 1: Route 53 Setup

```bash
# List hosted zones
aws route53 list-hosted-zones

# Create DNS record for your domain
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z35SXDOTRQ7X7K",
          "DNSName": "your-alb-xxxxx.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

### Step 2: SSL Certificate with ACM

```bash
# Request SSL certificate
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS

# Validate certificate in Route 53
# AWS will provide CNAME records to add
```

### Step 3: Update Load Balancer

```bash
# Add HTTPS listener with SSL certificate
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...
```

---

## Environment Variables Setup

Create `.env.production` with:

```bash
# Database
DATABASE_URL=postgresql://admin:password@vms-postgres.xxxxx.rds.amazonaws.com:5432/vms

# JWT
JWT_SECRET=your-secure-random-secret-here
JWT_REFRESH_SECRET=your-secure-random-secret-here

# API
FRONTEND_URL=https://yourdomain.com
API_URL=https://yourdomain.com/api

# Storage
STORAGE_PATH=/storage
AWS_S3_BUCKET=vms-storage-bucket
AWS_REGION=us-east-1

# CRM
STAGING_API_TOKEN=your-staging-token

# Environment
NODE_ENV=production
PORT=4000
```

---

## Monitoring & Scaling

### CloudWatch Monitoring

```bash
# Create alarm for high CPU
aws cloudwatch put-metric-alarm \
  --alarm-name vms-api-high-cpu \
  --alarm-description "Alert when CPU is high" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### Auto-Scaling

```bash
# Create autoscaling policy
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/vms-cluster/vms-api \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy
aws application-autoscaling put-scaling-policy \
  --policy-name vms-api-scaling \
  --service-namespace ecs \
  --resource-id service/vms-cluster/vms-api \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    }
  }'
```

---

## Cost Estimation

### Monthly Costs (Approximate)

| Service | Usage | Cost |
|---------|-------|------|
| **RDS PostgreSQL (t3.micro)** | Multi-AZ, 100GB storage | $30-50 |
| **ECS Fargate** | 512MB x2 tasks, 4000 hours/month | $40-60 |
| **ALB** | 1 load balancer | $20 |
| **Route 53** | Domain operations | $0.50 |
| **S3** | 10GB storage, minimal traffic | $1-5 |
| **CloudWatch** | Logs & monitoring | ~$5 |
| **Data Transfer** | Outbound traffic | Variable |
| **ACM** | SSL Certificate | FREE |
| **TOTAL** | Minimum setup | **~$100-150/month** |

### Cost Optimization Tips
1. Use t3.micro RDS for development
2. Use Fargate for variable load
3. Enable RDS reserved instances for production
4. Use S3 lifecycle policies
5. Monitor unused resources monthly

---

## Deployment Checklist

- [ ] AWS Account created with billing enabled
- [ ] AWS CLI installed and configured
- [ ] ECR repositories created
- [ ] Docker images built and pushed
- [ ] RDS PostgreSQL instance running
- [ ] ECS cluster created
- [ ] Task definitions registered
- [ ] Load balancer configured
- [ ] Security groups properly configured
- [ ] Environment variables set
- [ ] Database migrations applied
- [ ] Domain registered with Route 53
- [ ] SSL certificate created with ACM
- [ ] HTTPS listener configured
- [ ] Auto-scaling policies created
- [ ] CloudWatch alarms configured
- [ ] Backups configured
- [ ] Application tested in production

---

## Troubleshooting

### Common Issues

**1. ECS Task Failing to Start**
```bash
# Check logs
aws logs tail /ecs/vms-api --follow

# Check task status
aws ecs describe-tasks --cluster vms-cluster --tasks task-id
```

**2. Database Connection Issues**
- Verify security group allows port 5432
- Check RDS endpoint in environment variables
- Ensure database exists and is accessible

**3. Load Balancer Health Check Failing**
- Verify target group health check path
- Check security group allows traffic from ALB
- Ensure application is listening on correct port

**4. SSL Certificate Validation**
- Check Route 53 CNAME records
- Wait for certificate validation (can take 10-30 min)
- Verify domain ownership

---

## Next Steps

1. **Start with development environment** (single instance, t3.micro RDS)
2. **Test thoroughly** before moving to production
3. **Set up automated backups** for database
4. **Configure monitoring and alerts**
5. **Document all configurations**
6. **Plan for disaster recovery**

---

## Support Resources

- AWS Documentation: https://docs.aws.amazon.com
- ECS Documentation: https://docs.aws.amazon.com/ecs/
- RDS Documentation: https://docs.aws.amazon.com/rds/
- Pricing Calculator: https://calculator.aws/

---

**Status:** Ready for AWS Deployment ✅
**Estimated Setup Time:** 2-4 hours
**Difficulty Level:** Intermediate
