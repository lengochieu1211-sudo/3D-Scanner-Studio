# REPORT — 3D Scanner Studio v0.7 Photogrammetry Pipeline

## Nền source
- Dùng đúng FULL SOURCE v0.6 Object Reconstruction làm nền.
- Không rollback chức năng Human Scan, IndexedDB, Multi-device, PWA hoặc export mesh.
- Không push GitHub / không deploy.

## Đã sửa theo kiểm tra thực tế

### 1. Object Scan
- Giảm thời gian giữa auto keyframe 520 ms → 380 ms.
- Hạ ngưỡng blur/ánh sáng quá gắt để tránh tình trạng quay nhiều nhưng chỉ giữ 4 keyframe.
- Góc mới tối thiểu 9° → 6° khi có orientation.
- Fallback góc 15° → 12°/keyframe khi không có cảm biến.
- Hạ ngưỡng silhouette confidence để vật có nền phức tạp vẫn có cơ hội thu đủ dữ liệu.
- Thêm Align ảnh bằng OpenCV.js trước/ngoài Visual Hull.

### 2. Room Scan
- Thay logic chỉ `Lưu frame hiện trạng` bằng `Quét phòng liên tục`.
- Tự lấy tối đa 64 keyframe dựa trên:
  - độ nét,
  - ánh sáng,
  - độ thay đổi hình ảnh,
  - hướng thiết bị nếu có.
- Lưu keyframe gốc vào IndexedDB.
- Coverage 8 hướng.
- Thêm Align room keyframe bằng OpenCV.js.

### 3. Alignment engine miễn phí
File mới: `src/photogrammetry.ts`
- Tải OpenCV.js runtime miễn phí.
- ORB feature detector/descriptor.
- BFMatcher Hamming + Lowe ratio test.
- RANSAC homography để lọc match sai.
- Alignment score và cảnh báo overlap.
- Có fallback image-overlap score nếu OpenCV.js không tải được.

### 4. UI mobile
- Room có workflow riêng: Scan → Overlap → Coverage → Align → Dense/Mesh.
- Object hiển thị alignment status.
- Camera vẫn là phần chính; panel sau dùng cho review/chất lượng.

## Những gì là 3D thật
- Object Visual Hull/voxel mesh là geometry 3D thật.
- GLB/OBJ/PLY export từ mesh thật.
- ORB feature matching + RANSAC alignment là xử lý thật trên ảnh.

## Giới hạn được giữ minh bạch
- v0.7 **chưa có SfM camera pose 3D hoàn chỉnh**.
- Chưa có dense Multi-View Stereo hoàn chỉnh.
- Chưa texture bake photogrammetry lên mesh.
- Room chưa xuất mesh kiến trúc hoàn chỉnh từ ảnh camera thường.
- Không dùng cloud/API trả phí để giả lập các bước trên.

## Kiểm tra
- `src/photogrammetry.ts` standalone TypeScript check: PASS.
- TS/TSX syntax transpile `main.tsx` + `photogrammetry.ts`: PASS.
- `npm install --package-lock-only`: timeout trong môi trường hiện tại, nên không tạo lockfile giả.
- FULL `npm run lint/build`: chưa xác minh local do registry timeout. Workflow GitHub hiện tại vẫn dùng `npm install` khi chưa có lockfile.
- Không thêm Firebase/GitHub project config mới.
- Không thêm secret/API key.

## File thay đổi
- `package.json`
- `src/main.tsx`
- `src/style.css`
- `src/photogrammetry.ts` (mới)
- `public/sw.js`
- `README.md`
- `REPORT.md`

## Đề xuất v0.8
1. Camera intrinsics chuẩn từ track settings + calibration.
2. Essential/Fundamental matrix + recoverPose cho camera pose 3D.
3. Sparse 3D point cloud viewer thật.
4. Bundle adjustment/WASM worker.
5. Depth/LiDAR adapter.
6. Dense MVS/WebGPU hoặc local desktop engine miễn phí.
7. Texture projection/baking.
