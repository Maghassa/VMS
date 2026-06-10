# AWS Deployment - Quick Start (30 Minutes)

## ⚡ Quick Summary

Deploy your VMS to AWS in 30 minutes using this simplified guide.

---

## 📋 Prerequisites (5 minutes)

### 1. AWS Account
- Create account at https://aws.amazon.com
- Enable billing
- Get Access Key ID and Secret Access Key

### 2. Install AWS CLI
**Windows:**
```bash
# Using Chocolatey
choco install awscli

# Or download from AWS
# https://aws.amazon.com/cli/
```

**macOS/Linux:**
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### 3. Configure AWS Credentials
```bash
aws configure

# Enter:
AWS Access Key ID: [your-access-key]
AWS Secret Access Key: [your-secret-key]
Default region: us-east-1
Default output format: json
```

---

## 🚀 Fastest Deployment Method: Elastic Beanstalk (RECOMMENDED)

### Step 1: Install EB CLI
```bash
pip install awsebcli --upgrade --user
```

### Step 2: Create docker-compose.yml for Beanstalk

Create `docker-compose.prod.yml` in your VMS root:

```yaml
version: '3.8'

services:
  api:
    image: vms-api:latest
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://admin:password@vms.xxxxx.rds.amazonaws.com:5432/vms
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=${FRONTEND_URL}
    depends_on:
      - db

  frontend:
    image: vms-frontend:latest
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=${API_URL}

  db:
    image: pgvector/pgvector:pg15
    environment:
      - POSTGRES_DB=vms
      - POSTGRES_USER=admin
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### Step 3: Deploy with Elastic Beanstalk

```bash
# Initialize Elastic Beanstalk
eb init -p docker vms-app --region us-east-1

# Create environment
eb create vms-prod

# Deploy
eb deploy

# Open application
eb open
```

---

## 🐳 Alternative: ECS + RDS (More Control)

### Quick Commands

```bash
# 1. Create VPC & Security Groups
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=vms-vpc}]'

# 2. Create RDS Database
aws rds create-db-instance \
  --db-instance-identifier vms-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password MySecurePassword123! \
  --allocated-storage 100 \
  --engine-version 15

# 3. Create ECS Cluster
aws ecs create-cluster --cluster-name vms-cluster

# 4. Push Docker Images
aws ecr create-repository --repository-name vms-api
aws ecr create-repository --repository-name vms-frontend

# Get credentials and push
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com

docker build -t vms-api ./api
docker tag vms-api:latest [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/vms-api:latest
docker push [ACCOUNT_ID].dkr.ecr.us-east-1.amazonaws.com/vms-api:latest

# Repeat for frontend...
```

---

## 💻 EC2 + Docker Compose (Cheapest)

### Step 1: Launch EC2 Instance

```bash
# Create security group
aws ec2 create-security-group \
  --group-name vms-sg \
  --description "VMS Security Group"

# Allow SSH (port 22)
aws ec2 authorize-security-group-ingress \
  --group-name vms-sg \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0

# Allow HTTP (port 80)
aws ec2 authorize-security-group-ingress \
  --group-name vms-sg \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Allow HTTPS (port 443)
aws ec2 authorize-security-group-ingress \
  --group-name vms-sg \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Launch t3.small instance (Ubuntu)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.small \
  --key-name your-key-pair \
  --security-groups vms-sg
```

### Step 2: Connect and Deploy

```bash
# SSH into instance
ssh -i your-key.pem ec2-user@your-instance-public-ip

# Install Docker
sudo yum update -y
sudo yum install docker -y
sudo usermod -a -G docker ec2-user
sudo systemctl start docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone your repository
git clone https://github.com/yourname/vms.git
cd vms

# Update docker-compose.local.yml with production database URL
# Then start
docker-compose -f docker-compose.local.yml up -d
```

---

## 🔗 Configure Domain & SSL

### Step 1: Register Domain
1. Go to Route 53 in AWS Console
2. Register domain (or transfer existing)
3. Keep note of Hosted Zone ID

### Step 2: Get SSL Certificate
```bash
# Request certificate
aws acm request-certificate \
  --domain-name yourdomain.com \
  --subject-alternative-names www.yourdomain.com \
  --validation-method DNS

# Note the certificate ARN
```

### Step 3: Update DNS
```bash
# Get your load balancer / instance IP
# Then create DNS record in Route 53
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch file://dns-update.json
```

---

## 📊 Cost Comparison

| Method | Monthly Cost | Setup Time | Maintenance |
|--------|-------------|-----------|-------------|
| **Elastic Beanstalk** | $50-100 | 5 min | Minimal |
| **ECS + RDS** | $100-150 | 30 min | Medium |
| **EC2 + Docker** | $15-30 | 20 min | High |

---

## 🎯 Recommended Setup for Production

### Architecture
```
Domain (Route 53)
    ↓
CloudFront (CDN) - Optional
    ↓
Application Load Balancer
    ↓
ECS Tasks (API + Frontend)
    ↓
RDS PostgreSQL (Multi-AZ)
    ↓
S3 (Storage)
```

### Services to Enable
- ✅ Multi-AZ for RDS (high availability)
- ✅ Auto-scaling for ECS (handle traffic spikes)
- ✅ CloudWatch alarms (monitoring)
- ✅ Automated backups (every day)
- ✅ SSL/TLS encryption (HTTPS)

---

## 🔐 Environment Variables for Production

Create `production.env`:

```bash
# Database
DATABASE_URL=postgresql://admin:password@vms-db.xxxxx.rds.amazonaws.com:5432/vms

# JWT Keys (generate new ones!)
JWT_SECRET=your-256-character-random-secret-here
JWT_REFRESH_SECRET=your-256-character-random-secret-here

# URLs
FRONTEND_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com
DOMAIN=yourdomain.com

# Storage
STORAGE_PATH=/storage
AWS_S3_BUCKET=vms-storage-bucket
AWS_REGION=us-east-1

# CRM
STAGING_API_TOKEN=your-secure-staging-token

# Environment
NODE_ENV=production
```

---

## ✅ Deployment Checklist

- [ ] AWS Account created with billing
- [ ] AWS CLI installed and configured
- [ ] Domain registered / transferred to Route 53
- [ ] SSL certificate requested with ACM
- [ ] RDS database created and accessible
- [ ] ECS/Beanstalk/EC2 instances running
- [ ] Docker images built and pushed to ECR
- [ ] Environment variables configured
- [ ] Database migrations applied (prisma db push)
- [ ] Load balancer configured with HTTPS
- [ ] Domain DNS records pointing to load balancer
- [ ] Application accessible via https://yourdomain.com
- [ ] SSL certificate validated
- [ ] Monitoring and alarms configured
- [ ] Backups enabled
- [ ] Application tested in production

---

## 📞 Quick Support

### Database Connection Issues
```bash
# Test connection
psql -h vms-db.xxxxx.rds.amazonaws.com -U admin -d vms

# Check security group
aws ec2 describe-security-groups --group-names vms-db-sg
```

### View Logs
```bash
# ECS Logs
aws logs tail /ecs/vms-api --follow

# Elastic Beanstalk Logs
eb logs
```

### Monitoring
```bash
# View metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ClusterName,Value=vms-cluster \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 300 \
  --statistics Average
```

---

## 🚨 Security Best Practices

1. **Use AWS Secrets Manager** for sensitive data
   ```bash
   aws secretsmanager create-secret \
     --name vms/jwt-secret \
     --secret-string "your-secret-value"
   ```

2. **Enable VPC** - Don't expose RDS to internet

3. **Use IAM Roles** - Not access keys in code

4. **Enable CloudTrail** - Audit all AWS actions

5. **Rotate Credentials** - Change passwords quarterly

6. **Backup Strategy**
   - Daily automated RDS backups (30 days)
   - Weekly S3 backup copies
   - Test restore monthly

---

## 📈 Scaling for Growth

### When you need more power:

**Week 1-4:** EC2 t3.small + RDS t3.micro = $20-30/month

**Month 2-6:** Add Elastic Beanstalk + RDS t3.small = $50-100/month

**Month 6+:** ECS + RDS t3.medium + ElastiCache = $150-300/month

---

## 🎓 Learning Resources

- **AWS Official:** https://aws.amazon.com/training/
- **Elastic Beanstalk:** https://docs.aws.amazon.com/elasticbeanstalk/
- **ECS Basics:** https://docs.aws.amazon.com/ecs/latest/developerguide/
- **RDS PostgreSQL:** https://docs.aws.amazon.com/rds/latest/userguide/

---

**Status:** Ready to Deploy ✅
**Estimated Deploy Time:** 30 minutes to 2 hours
**Difficulty:** Easy to Medium
