# 3D Scanner Studio v0.7 — Photogrammetry Pipeline

Ứng dụng web/PWA mobile-first để thu dữ liệu 3D bằng camera điện thoại, chạy local-first và ưu tiên giải pháp miễn phí.

## Trọng tâm v0.7

### Quét vật thể
- Quét liên tục, tự lấy keyframe nhanh hơn bản v0.6.
- Khóa vật thể bằng nhận diện AI hoặc vùng giữa màn hình.
- Tạo silhouette và dựng Visual Hull 3D thật trên trình duyệt.
- Feature matching/Align bằng OpenCV.js miễn phí: ORB + BFMatcher + RANSAC.
- Preview mesh và xuất GLB / OBJ / PLY.

### Quét phòng
- Đã có **Quét phòng liên tục** thay vì chỉ lưu frame thủ công.
- Tự lấy keyframe theo độ nét + thay đổi hình ảnh + góc cảm biến nếu có.
- Coverage 360°.
- Align keyframe bằng OpenCV.js để kiểm tra overlap và khả năng liên kết ảnh.
- Lưu frame gốc vào IndexedDB để không mất dữ liệu khi xử lý tiếp.

### Quét người
- Đầu & vai / nửa người trên / toàn thân / Face Detail.
- Pose + Face Mesh + Hands tracking.
- Quét liên tục, tự giữ frame đạt chất lượng.

### Multi-device
- Giữ WebRTC P2P Host/Join và đồng bộ trạng thái từ các bản trước.

## Free / local-first
- Không API photogrammetry trả phí.
- Không cloud reconstruction bắt buộc.
- OpenCV.js được tải trực tiếp để chạy feature matching trên thiết bị.
- Dữ liệu scan mặc định lưu trên thiết bị bằng IndexedDB.
- GitHub Pages dùng để host frontend.

## Luồng photogrammetry mục tiêu

Capture → Mask → Align → Camera Pose/SfM → Sparse Cloud → Dense/MVS/Depth → Mesh → Texture → Clean → Export

v0.7 đã triển khai Capture, Mask, Align foundation và Visual Hull object mesh. SfM 3D đầy đủ, dense MVS và texture baking chưa được giả lập là đã hoàn thiện.

## Chạy local

```bash
npm install
npm run lint
npm run build
npm run dev
```

## GitHub Pages

Workflow `.github/workflows/deploy.yml` dùng Node 22, lint, build và deploy Pages.
