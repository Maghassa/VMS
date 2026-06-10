#!/bin/bash

# VMS AWS Deployment Script
# This script automates the deployment of VMS to AWS ECS

set -e

echo "🚀 VMS AWS Deployment Script"
echo "=============================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION=${AWS_REGION:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
VMS_CLUSTER_NAME="vms-cluster"
VMS_DB_NAME="vms-postgres"

echo -e "${BLUE}Configuration:${NC}"
echo "AWS Region: $AWS_REGION"
echo "AWS Account ID: $AWS_ACCOUNT_ID"
echo ""

# Step 1: Check prerequisites
echo -e "${BLUE}Step 1: Checking Prerequisites${NC}"
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ AWS CLI found${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install it first.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker found${NC}"

# Step 2: Create ECR repositories
echo ""
echo -e "${BLUE}Step 2: Creating ECR Repositories${NC}"

echo "Creating vms-frontend repository..."
aws ecr create-repository \
    --repository-name vms-frontend \
    --region $AWS_REGION \
    --no-cli-pager 2>/dev/null || echo "Repository already exists"
echo -e "${GREEN}✅ Frontend repository ready${NC}"

echo "Creating vms-api repository..."
aws ecr create-repository \
    --repository-name vms-api \
    --region $AWS_REGION \
    --no-cli-pager 2>/dev/null || echo "Repository already exists"
echo -e "${GREEN}✅ API repository ready${NC}"

# Step 3: Push Docker images
echo ""
echo -e "${BLUE}Step 3: Building and Pushing Docker Images${NC}"

echo "Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | \
    docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

echo "Building and pushing frontend image..."
docker build -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/vms-frontend:latest ./frontend
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/vms-frontend:latest
echo -e "${GREEN}✅ Frontend image pushed${NC}"

echo "Building and pushing API image..."
docker build -t $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/vms-api:latest ./api
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/vms-api:latest
echo -e "${GREEN}✅ API image pushed${NC}"

# Step 4: Create ECS Cluster
echo ""
echo -e "${BLUE}Step 4: Creating ECS Cluster${NC}"

echo "Creating cluster..."
aws ecs create-cluster \
    --cluster-name $VMS_CLUSTER_NAME \
    --region $AWS_REGION \
    --no-cli-pager 2>/dev/null || echo "Cluster already exists"
echo -e "${GREEN}✅ ECS cluster ready${NC}"

# Step 5: Information
echo ""
echo -e "${GREEN}✅ Deployment Steps Completed!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Create RDS PostgreSQL database:"
echo "   aws rds create-db-instance --db-instance-identifier $VMS_DB_NAME ..."
echo ""
echo "2. Create security groups:"
echo "   - For ECS tasks (allow ports 3000, 4000)"
echo "   - For RDS (allow port 5432)"
echo ""
echo "3. Create Application Load Balancer"
echo ""
echo "4. Create task definitions for API and Frontend"
echo ""
echo "5. Create ECS services"
echo ""
echo "6. Register domain and configure Route 53"
echo ""
echo "7. Create SSL certificate with ACM"
echo ""
echo "8. Configure load balancer listeners (HTTP -> HTTPS)"
echo ""
echo -e "${BLUE}Docker Images Created:${NC}"
echo "Frontend: $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/vms-frontend:latest"
echo "API:      $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/vms-api:latest"
echo ""
echo -e "${BLUE}Full guide available in: AWS_DEPLOYMENT_GUIDE.md${NC}"
