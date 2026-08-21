# REPORT — 3D Scanner Studio v0.6 Object Reconstruction

## Nền source
- Dùng đúng FULL SOURCE v0.5.1 Fix Build làm nền.
- Không rollback sang bản cũ.
- Giữ Room Scan, Human Tracking, Motion Capture, IndexedDB, PWA, WebRTC multi-device và GitHub Pages workflow.

## Thay đổi chính
- Viết lại luồng Object Scan theo Continuous Scan.
- Khóa vật thể bằng MediaPipe Object Detector; có fallback vùng quét thủ công cho vật thể AI không biết tên.
- Tự lấy keyframe khi ảnh đủ sáng/nét và góc thay đổi.
- Dùng DeviceOrientation nếu có; fallback timed-angle khi không có.
- Tách silhouette cục bộ từ vùng vật thể và làm sạch mask.
- Thêm coverage 360° 8 hướng.
- Thêm reconstruction 3D thật bằng Visual Hull / voxel carving.
- Thêm WebGL 3D preview bằng Three.js.
- Xuất GLB, OBJ và PLY thật từ mesh vừa dựng.
- Có scale theo chiều rộng thực tế người dùng nhập (mm).
- Human Scan tách profile Đầu & vai / Nửa người / Toàn thân / Face Detail; chân không bị tính thiếu nếu profile không yêu cầu.
- Giữ Pose + Face Mesh + Hand Tracking.
- Thêm Human Continuous Scan: tự giữ keyframe khi tracking đúng vùng đã chọn, ảnh đủ nét/sáng; không bắt buộc chân nếu profile không yêu cầu.
- Service Worker cache tăng lên v6.

## File thêm
- `src/reconstruction.ts`: segmentation, keyframe geometry, visual hull, voxel surface mesh, GLB/OBJ/PLY export.
- `src/preview3d.ts`: 3D mesh preview và thao tác xoay.

## File sửa
- `src/main.tsx`
- `src/style.css`
- `package.json` → version 0.6.0
- `public/sw.js`
- `README.md`
- `REPORT.md`

## Logic / giới hạn được giữ đúng
- Visual Hull là reconstruction geometry thật nhưng không phải photogrammetry texture hoàn chỉnh.
- Vật lõm sâu, kính, gương, vật bóng và nền cùng màu vật thể có thể gây silhouette sai.
- AI detector không nhận được vật lạ vẫn có fallback vùng khóa thủ công.
- Room Scan chưa giả dựng mesh kiến trúc khi chưa có camera pose/depth fusion.
- Human tracking chưa giả thành human mesh/rig.
- Multi-device chưa truyền ảnh/video lớn cho tới khi có chunking/checksum/retry.

## Kiểm tra
- TypeScript/TSX syntax transpile: PASS cho main.tsx, reconstruction.ts, preview3d.ts, multidevice.ts, storage.ts, vision.ts.
- GitHub workflow: giữ Node 22, lint → build → Pages deploy.
- `package.json`: dependencies khóa version, không dùng `latest`.
- `package-lock.json`: chưa sinh được trong môi trường làm việc do npm registry timeout; GitHub Actions trước đó của project đã chứng minh install/lint/build chạy được với source v0.5.1. Cần xác nhận lại v0.6 sau khi push.
- Secret scan: không thêm API key/token/private key.
- Firebase: project này không có Firebase config và không thêm/đổi Firebase.
- GitHub repo/deploy: không push, không deploy.

## Nâng cấp tiếp theo đề xuất
1. SfM camera pose + feature matching.
2. Multi-view stereo / depth fusion.
3. Texture projection + blending.
4. Mesh decimation, normals, hole filling.
5. Multi-device frame chunking + checksum + resume.
6. Human silhouette reconstruction + retopo + rig.
