# 3D Scanner Studio v0.6 — Object Reconstruction

Web/PWA mobile-first cho quét phòng, vật thể, người và motion capture. v0.6 chuyển trọng tâm sang **reconstruction vật thể 3D thật trên trình duyệt**.

## Object Scan v0.6

1. Bật camera sau.
2. Đặt vật thể trên nền tương đối đơn giản, ánh sáng đều.
3. Bấm **Khóa vật thể** hoặc chạm vào bounding box AI.
4. Bấm **Quét liên tục** và đi chậm một vòng 360° quanh vật thể.
5. App tự bỏ frame mờ/tối, tự lấy keyframe theo góc.
6. Nhập chiều rộng thực tế của vật thể (mm).
7. Bấm **Dựng 3D**.
8. Xoay kiểm tra model và xuất GLB / OBJ / PLY.

### Reconstruction hiện tại

v0.6 dùng **silhouette visual hull + voxel carving**. Đây là geometry 3D thật, không phải hình minh họa. Ưu điểm: chạy local trên browser, không cần server/GPU trả phí. Giới hạn: bề mặt lõm sâu, vật bóng/trong suốt và texture photogrammetry chưa được tái tạo đầy đủ.

## Human Scan

Có 4 profile: Đầu & vai, Nửa người trên, Toàn thân, Face Detail. Camera hiển thị Pose + Face Mesh + Hands và có **quét liên tục** tự giữ frame đạt chất lượng theo đúng profile. Skeleton chỉ dùng tracking; mục tiêu cuối là body surface → retopology → humanoid rig → skin weight.

## Multi-device

Giữ WebRTC P2P Offer/Answer thủ công cho trạng thái phiên quét. Ảnh dung lượng lớn chưa tự truyền P2P cho tới khi có chunking + checksum + retry/resume.

## Chạy local

```bash
npm install
npm run lint
npm run build
npm run dev
```

Mở `http://localhost:5173` trên PC. Camera trên thiết bị khác cần HTTPS hoặc localhost/ADB reverse.

## GitHub Pages

Workflow `.github/workflows/deploy.yml` build bằng Node 22 và deploy Pages. Trong repo GitHub phải bật **Settings → Pages → Source: GitHub Actions**.
