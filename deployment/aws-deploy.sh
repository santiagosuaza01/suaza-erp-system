#!/bin/bash

# Script de despliegue para AWS - Sistema Suaza
# Este script despliega el sistema completo en AWS

set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_message() {
    echo -e "${GREEN}[AWS DEPLOY]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[ADVERTENCIA]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI no está instalado. Instálalo desde: https://aws.amazon.com/cli/"
    exit 1
fi

# Verificar Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado. Necesario para construir imágenes."
    exit 1
fi

print_message "🚀 Iniciando despliegue en AWS..."

# Variables de configuración
PROJECT_NAME="suaza"
REGION="us-east-1"
ECR_REPOSITORY="${PROJECT_NAME}-repo"
CLUSTER_NAME="${PROJECT_NAME}-cluster"
SERVICE_NAME="${PROJECT_NAME}-service"
TASK_DEFINITION="${PROJECT_NAME}-task"

# 1. Crear ECR Repository
print_message "Creando ECR Repository..."
aws ecr create-repository --repository-name $ECR_REPOSITORY --region $REGION || true

# 2. Obtener login token para ECR
print_message "Autenticando con ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com

# 3. Construir y subir imágenes Docker
print_message "Construyendo imágenes Docker..."

# Backend
cd backend
docker build -t $ECR_REPOSITORY:backend .
docker tag $ECR_REPOSITORY:backend $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com/$ECR_REPOSITORY:backend
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com/$ECR_REPOSITORY:backend
cd ..

# Frontend
cd frontend
docker build -t $ECR_REPOSITORY:frontend .
docker tag $ECR_REPOSITORY:frontend $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com/$ECR_REPOSITORY:frontend
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com/$ECR_REPOSITORY:frontend
cd ..

# 4. Crear RDS PostgreSQL
print_message "Creando base de datos RDS..."
aws rds create-db-instance \
    --db-instance-identifier "${PROJECT_NAME}-db" \
    --db-instance-class db.t3.micro \
    --engine postgres \
    --engine-version 15.4 \
    --master-username suaza_admin \
    --master-user-password "Suaza2024!" \
    --allocated-storage 20 \
    --storage-type gp2 \
    --db-name suaza_prod \
    --backup-retention-period 7 \
    --region $REGION || true

# 5. Crear ECS Cluster
print_message "Creando ECS Cluster..."
aws ecs create-cluster --cluster-name $CLUSTER_NAME --region $REGION || true

# 6. Crear Task Definition
print_message "Creando Task Definition..."
cat > task-definition.json << EOF
{
    "family": "$TASK_DEFINITION",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "1024",
    "memory": "2048",
    "executionRoleArn": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/ecsTaskExecutionRole",
    "containerDefinitions": [
        {
            "name": "backend",
            "image": "$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com/$ECR_REPOSITORY:backend",
            "portMappings": [
                {
                    "containerPort": 3001,
                    "protocol": "tcp"
                }
            ],
            "environment": [
                {
                    "name": "NODE_ENV",
                    "value": "production"
                },
                {
                    "name": "DATABASE_URL",
                    "value": "postgresql://suaza_admin:Suaza2024!@${PROJECT_NAME}-db.$(aws rds describe-db-instances --db-instance-identifier "${PROJECT_NAME}-db" --query 'DBInstances[0].Endpoint.Address' --output text):5432/suaza_prod"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/$TASK_DEFINITION",
                    "awslogs-region": "$REGION",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        },
        {
            "name": "frontend",
            "image": "$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com/$ECR_REPOSITORY:frontend",
            "portMappings": [
                {
                    "containerPort": 80,
                    "protocol": "tcp"
                }
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/$TASK_DEFINITION",
                    "awslogs-region": "$REGION",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        }
    ]
}
EOF

aws ecs register-task-definition --cli-input-json file://task-definition.json --region $REGION

# 7. Crear Application Load Balancer
print_message "Creando Load Balancer..."
aws elbv2 create-load-balancer \
    --name "${PROJECT_NAME}-alb" \
    --subnets $(aws ec2 describe-subnets --query 'Subnets[0:2].SubnetId' --output text) \
    --security-groups $(aws ec2 describe-security-groups --query 'SecurityGroups[0].GroupId' --output text) \
    --region $REGION || true

# 8. Crear ECS Service
print_message "Creando ECS Service..."
aws ecs create-service \
    --cluster $CLUSTER_NAME \
    --service-name $SERVICE_NAME \
    --task-definition $TASK_DEFINITION \
    --desired-count 2 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$(aws ec2 describe-subnets --query 'Subnets[0:2].SubnetId' --output text)],securityGroups=[$(aws ec2 describe-security-groups --query 'SecurityGroups[0].GroupId' --output text)],assignPublicIp=ENABLED}" \
    --region $REGION || true

print_message "✅ Despliegue completado!"
print_message "🌐 URL del sistema: http://$(aws elbv2 describe-load-balancers --names "${PROJECT_NAME}-alb" --query 'LoadBalancers[0].DNSName' --output text)"
print_message "📊 Monitoreo: https://console.aws.amazon.com/ecs/home?region=$REGION#/clusters/$CLUSTER_NAME" 