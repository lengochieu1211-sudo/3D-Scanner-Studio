# 3D Scanner Studio v0.5 UI Pro

Bản nâng cấp giao diện chuyên nghiệp, mobile-first, phát triển từ v0.4 Multi-Device. Logic quét, MediaPipe, IndexedDB và WebRTC P2P được giữ nguyên.

# 3D Scanner Studio v0.4 Multi-Device Foundation

Web/PWA mobile-first để thu dữ liệu quét phòng, vật thể, người và motion capture, có nền multi-device thật bằng WebRTC P2P.

## Có trong v0.4

- Camera mobile/PC, chọn camera, đổi camera, nhiều độ phân giải.
- MediaPipe Pose + Face + Hands cho Human/Mocap.
- Object Detector cho Object Scan.
- Device & Scan Self-Test, Quality Score, Coverage 360°.
- IndexedDB v2: lưu frame cục bộ, metadata project và session; có migration từ v0.3.
- Multi-Device Scan Foundation:
  - Host / Join bằng WebRTC DataChannel P2P thật.
  - Ghép nối Offer/Answer thủ công, không giả lập QR/signaling server.
  - Session code, vai trò Front/Back/Left/Right/Top/Auto.
  - State machine: Idle → Calibrating → Ready → Scanning → Paused → Processing → Review → Export.
  - Đồng bộ state, thiết bị, tracking/FPS/resolution/depth capability và coverage sector.
  - Calibration theo kích thước chuẩn/marker.
  - Test Lab mô phỏng 3 điện thoại để kiểm tra UI trên PC.
  - Recovery metadata của session trong IndexedDB.
- Export JSON v4 chứa metadata camera + device + session; ảnh không bị nhúng Base64.
- PWA shell và GitHub Pages workflow.

## Chủ động chưa giả lập

- QR signaling tự động giữa điện thoại (GitHub Pages không cung cấp signaling backend).
- Truyền hàng loạt ảnh/video dung lượng lớn qua P2P chưa bật cho tới khi có chunking, retry và kiểm tra dung lượng.
- Camera pose / SLAM / VIO thật.
- LiDAR / ARKit depth native adapter thật.
- Point cloud / depth fusion / mesh reconstruction thật.
- Retopology, humanoid rig, skin weight và GLB/FBX có mesh/rig thật.

## Ghép 2 điện thoại không cần server

1. Mở cùng trang HTTPS trên cả hai máy.
2. Máy Host: Multi-Device → Tạo Offer → gửi chuỗi Offer sang máy Join.
3. Máy Join: dán Offer vào ô nhận → `Dán Offer → tạo Answer` → gửi Answer về Host.
4. Máy Host: dán Answer → `Nhận Answer`.
5. Khi WebRTC báo `connected`, trạng thái và coverage sẽ được đồng bộ P2P.

Cách này cố ý hơi thủ công nhưng là kết nối thật và không cần backend trả phí. QR/signaling tự động có thể bổ sung sau mà không thay kiến trúc P2P.

## Test local

```bash
npm install
npm run lint
npm run build
npm run dev
```

Mở `http://localhost:5173` trên PC. Trên Android có thể dùng ADB reverse để thử camera qua localhost trước khi push GitHub.
