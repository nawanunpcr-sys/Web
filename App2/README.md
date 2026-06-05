# ระบบวิเคราะห์กฎหมายความปลอดภัยและสุขภาพ
## Legal Registry Analysis Web Application

### โครงสร้างไฟล์ (File Structure)
```
APP/
├── index.html    – หน้าหลัก (HTML structure + Supabase SDK)
├── styles.css    – สไตล์ชีท (Dark professional theme)
├── app.js        – ตรรกะหลักของแอปพลิเคชัน (Supabase + Claude AI)
└── README.md     – คู่มือนี้
```

### ฟีเจอร์หลัก (Core Features)

#### 1. แดชบอร์ด (Dashboard)
- สถิติรวม: จำนวนกฎหมาย, ระดับวิกฤต, จำนวนการวิเคราะห์ AI, จำนวนแผนก
- รายการกฎหมายล่าสุดพร้อมระดับความสำคัญและสถานะ

#### 2. ดึงข้อมูลราชกิจจานุเบกษา (Gazette Retrieval)
- กรอก URL ราชกิจจานุเบกษาหรือคำค้นหา
- Claude AI ช่วยค้นหาและแยกวิเคราะห์ข้อมูลกฎหมาย
- ตรวจสอบและแก้ไขข้อมูลก่อนบันทึกลง Supabase

#### 3. ฐานข้อมูลกฎหมาย (Laws Database)
- แสดงกฎหมายทั้งหมดจาก Supabase
- กรองตามสถานะและระดับความสำคัญ
- ค้นหาด้วยชื่อหรือรหัสกฎหมาย

#### 4. วิเคราะห์กฎหมาย AI (AI Analysis)
- วิเคราะห์กฎหมายด้วย Claude Sonnet 4
- ระบุ: ใคร / ต้องทำอะไร / ที่ไหน / อย่างไร
- บทลงโทษ, กำหนดเวลา, เคล็ดลับการปฏิบัติตาม
- บันทึกผลวิเคราะห์ลงตาราง `ai_analyses`

#### 5. บันทึกการปฏิบัติตามกฎหมาย (Compliance Records)
- บันทึกผลการประเมินการปฏิบัติตามกฎหมาย
- คะแนน 0–100 พร้อม progress bar
- ระบุข้อค้นพบและมาตรการแก้ไข

### Supabase Configuration
- **Project**: legal-registry (ap-southeast-1)
- **URL**: https://gjxdqzmpuenqwvusywea.supabase.co
- **Tables**: laws, law_categories, departments, ai_analyses, compliance_records, tasks, notifications

### วิธีใช้งาน (Usage)
เปิดไฟล์ `index.html` ในเว็บเบราว์เซอร์ (ต้องการการเชื่อมต่ออินเทอร์เน็ตสำหรับ Supabase และ Claude API)

### หมายเหตุ
- Claude API key จัดการโดย Anthropic (ไม่ต้องใส่ key เพิ่มเติม)
- แอปรองรับภาษาไทยเต็มรูปแบบ
- Responsive design รองรับทั้ง Desktop และ Mobile
