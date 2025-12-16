# AWS GPU Deployment Guide

Complete guide to deploy Chatterbox TTS on AWS with GPU acceleration.

## 🎯 Instance Recommendation

**Instance Type:** g4dn.xlarge
- 4 vCPUs
- 16 GB RAM
- 1 NVIDIA T4 GPU (16GB VRAM)
- Cost: $0.526/hour on-demand (~$378/month)
- Cost: $0.21/hour reserved (~$150/month with 1-year commitment)

## 🚀 Quick Deployment (15 Minutes)

### Step 1: Launch EC2 Instance

```bash
# Using AWS CLI
aws ec2 run-instances \
  --image-id ami-0c7217cdde317cfec \
  --instance-type g4dn.xlarge \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxx \
  --subnet-id subnet-xxxxx \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":50}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=chatterbox-tts}]'
```

**Or via AWS Console:**
1. Go to EC2 → Launch Instance
2. Name: `chatterbox-tts`
3. AMI: Deep Learning AMI (Ubuntu 22.04) - `ami-0c7217cdde317cfec`
4. Instance type: `g4dn.xlarge`
5. Key pair: Select or create
6. Security group: Allow ports 22, 8001
7. Storage: 50GB gp3
8. Launch

### Step 2: Configure Security Group

Allow inbound traffic:
- Port 22 (SSH) from your IP
- Port 8001 (Chatterbox API) from your backend server IP
- Port 8001 from 0.0.0.0/0 (if testing, restrict later)

### Step 3: SSH and Install

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-public-ip

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker (if not pre-installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# Verify GPU
nvidia-smi
```

### Step 4: Deploy Chatterbox

```bash
# Clone your repository
git clone https://github.com/your-username/ai-sdr-outbound.git
cd ai-sdr-outbound/chatterbox-tts-service

# Create voices directory
mkdir -p voices cache

# Start service
docker compose up -d

# Check logs
docker compose logs -f

# Wait for "✅ Chatterbox TTS ready!"
```

### Step 5: Test Service

```bash
# From your local machine
curl http://your-instance-public-ip:8001/health

# Expected response:
# {
#   "status": "healthy",
#   "model_loaded": true,
#   "device": "cuda",
#   "cuda_available": true
# }
```

### Step 6: Update Backend

```bash
# On your local machine, edit backend/.env
USE_CHATTERBOX=true
CHATTERBOX_TTS_URL=http://your-instance-public-ip:8001

# Restart backend
cd backend
npm run dev
```

---

## 🔒 Security Hardening

### 1. Restrict Security Group

```bash
# Only allow backend server IP
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 8001 \
  --cidr your-backend-ip/32
```

### 2. Use Private IP (VPC Peering)

If backend is also on AWS:
```bash
# backend/.env
CHATTERBOX_TTS_URL=http://private-ip:8001
```

### 3. Add API Key Authentication

Edit `chatterbox-tts-service/app.py`:
```python
from fastapi import Header, HTTPException

API_KEY = os.getenv("CHATTERBOX_API_KEY", "your-secret-key")

async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

@app.post("/synthesize", dependencies=[Depends(verify_api_key)])
async def synthesize_speech(request: TTSRequest):
    # ... existing code
```

---

## 📊 Monitoring

### CloudWatch Metrics

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb

# Configure metrics
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json
```

### GPU Monitoring

```bash
# Install nvidia-smi exporter for Prometheus
docker run -d --gpus all \
  -p 9445:9445 \
  nvidia/dcgm-exporter:latest
```

### Application Logs

```bash
# View logs
docker compose logs -f chatterbox-tts

# Export to CloudWatch
aws logs create-log-group --log-group-name /chatterbox/tts
```

---

## 🔄 Auto-Scaling (Optional)

For high volume (500+ calls/day):

### 1. Create AMI

```bash
# After setup, create AMI
aws ec2 create-image \
  --instance-id i-xxxxx \
  --name "chatterbox-tts-v1" \
  --description "Chatterbox TTS with GPU"
```

### 2. Launch Template

```bash
aws ec2 create-launch-template \
  --launch-template-name chatterbox-tts \
  --version-description "v1" \
  --launch-template-data '{
    "ImageId": "ami-xxxxx",
    "InstanceType": "g4dn.xlarge",
    "SecurityGroupIds": ["sg-xxxxx"]
  }'
```

### 3. Auto Scaling Group

```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name chatterbox-tts-asg \
  --launch-template LaunchTemplateName=chatterbox-tts \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 1 \
  --target-group-arns arn:aws:elasticloadbalancing:...
```

---

## 💰 Cost Optimization

### 1. Reserved Instances

Save 60% with 1-year commitment:
```bash
aws ec2 purchase-reserved-instances-offering \
  --reserved-instances-offering-id xxxxx \
  --instance-count 1
```

### 2. Spot Instances (Not Recommended)

For non-critical workloads:
- 70% cheaper but can be terminated
- Use with auto-scaling for resilience

### 3. Scheduled Scaling

Turn off during non-business hours:
```bash
# Stop at 6 PM
aws autoscaling put-scheduled-update-group-action \
  --auto-scaling-group-name chatterbox-tts-asg \
  --scheduled-action-name stop-evening \
  --recurrence "0 18 * * *" \
  --desired-capacity 0

# Start at 8 AM
aws autoscaling put-scheduled-update-group-action \
  --auto-scaling-group-name chatterbox-tts-asg \
  --scheduled-action-name start-morning \
  --recurrence "0 8 * * *" \
  --desired-capacity 1
```

---

## 🔧 Troubleshooting

### GPU Not Detected

```bash
# Check NVIDIA driver
nvidia-smi

# Reinstall if needed
sudo apt-get install -y nvidia-driver-535
sudo reboot

# Verify Docker GPU access
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi
```

### Service Won't Start

```bash
# Check logs
docker compose logs chatterbox-tts

# Check disk space
df -h

# Check memory
free -h

# Restart service
docker compose restart
```

### Slow Performance

```bash
# Check GPU usage
nvidia-smi -l 1

# Check if model is on GPU
docker exec -it chatterbox-tts-service python3 -c "
import torch
print('CUDA available:', torch.cuda.is_available())
print('CUDA device:', torch.cuda.get_device_name(0))
"

# Check Docker resources
docker stats chatterbox-tts-service
```

---

## 📈 Performance Benchmarks

Expected performance on g4dn.xlarge:

| Text Length | Synthesis Time | Throughput |
|-------------|----------------|------------|
| 10 words | 150-200ms | ~50 req/sec |
| 50 words | 180-250ms | ~40 req/sec |
| 100 words | 220-300ms | ~30 req/sec |

**Concurrent Requests:** 5-10 simultaneous without degradation

---

## 🎯 Production Checklist

- [ ] Instance launched with correct AMI
- [ ] Security group configured (ports 22, 8001)
- [ ] NVIDIA drivers installed and working
- [ ] Docker and NVIDIA Container Toolkit installed
- [ ] Chatterbox service running and healthy
- [ ] Health check returns "cuda" device
- [ ] Test synthesis completes in <300ms
- [ ] Backend .env updated with instance IP
- [ ] Backend can reach Chatterbox service
- [ ] Test call completes successfully
- [ ] CloudWatch monitoring configured
- [ ] Backups configured (AMI snapshots)
- [ ] Reserved instance purchased (cost savings)

---

## 📞 Support

- AWS Support: [AWS Console](https://console.aws.amazon.com/support)
- Chatterbox Issues: [GitHub](https://github.com/resemble-ai/chatterbox/issues)
- NVIDIA Container Toolkit: [Docs](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/)
