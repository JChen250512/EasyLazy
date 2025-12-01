// --- JavaScript 邏輯區 ---

// ⭐ 全域變數：Google Apps Script 網址 ⭐
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzHV8KLPw390a8MIgQg1YTTt-g5B_ughmXB86jajc32dcBjmkaQ0p7vQ8qA99mPtPNY/exec'; 

// 1. 服務時間對照表
const SERVICE_DETAILS = {
    'single_custom': { text: '日式單根嫁接-客製款', time: 1 } 
};

// 2. 輔助函式：時間轉分鐘數（保留）
function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const [hour, minute] = timeStr.split(':').map(Number);
    return hour * 60 + minute;
}

// 3. 更新服務資訊
function updateServiceInfo() {
    generateTimeSlots();
}

// 4. 從 Google Sheet 讀取預約資料
async function fetchBookedAppointments(date) {
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'GET' });
        if (!response.ok) throw new Error(response.statusText);

        const data = await response.json();
        const allAppointments = data.records || data;
        return allAppointments.filter(app => app['預約日期']?.trim() === date);
    } catch (err) {
        console.error('讀取預約資料失敗:', err);
        alert('❌ 無法讀取預約資料，請稍後再試。');
        return [];
    }
}

// 5. 生成時段按鈕
async function generateTimeSlots() {
    const container = document.getElementById('timeSlotsContainer');
    const dateInput = document.getElementById('date');
    const selectedDateStr = dateInput.value;

    container.innerHTML = '';

    if (!selectedDateStr) {
        container.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">請選擇日期</div>';
        return;
    }

    // 處理最小日期限制
    const minDate = new Date(2025, 11, 19); // 月份從 0 開始
    const parts = selectedDateStr.split('-');
    const selectedDate = new Date(parts[0], parts[1]-1, parts[2]);

    if (selectedDate < minDate) {
        alert("⚠️ 請選擇 2025-12-19 或之後的日期！");
        dateInput.value = "2025-12-19";
        updateServiceInfo();
        return;
    }

    container.innerHTML = '<div style="grid-column:1/-1;color:var(--primary-color);text-align:center;font-weight:bold;">預約資料加載中...</div>';

    // 判斷平日/假日
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday
    let fixedSlots = [];
    if (dayOfWeek >= 1 && dayOfWeek <= 5) fixedSlots = ['19:00'];
    else if (dayOfWeek === 0 || dayOfWeek === 6) fixedSlots = ['10:00','13:30'];
    else {
        container.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">該日期不開放預約</div>';
        return;
    }

    // 讀取當日已預約資料
    const bookedAppointments = await fetchBookedAppointments(selectedDateStr);
    container.innerHTML = '';
    const bookedTimes = bookedAppointments.map(app => app['預約時段']);
    const now = new Date();
    let availableCount = 0;

    for (const timeLabel of fixedSlots) {
        const [hour, minute] = timeLabel.split(':').map(Number);
        const slotDateTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hour, minute, 0);

        let isDisabled = slotDateTime <= now;
        let disabledReason = isDisabled ? '此時段已過' : (bookedTimes.includes(timeLabel) ? '時段已被預約' : '');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'time-btn';
        btn.innerText = timeLabel;
        if (isDisabled || disabledReason) {
            btn.disabled = true;
            btn.title = disabledReason;
        } else {
            btn.onclick = () => selectTime(btn, timeLabel);
            availableCount++;
        }
        container.appendChild(btn);
    }

    if (availableCount === 0) {
        container.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">本日已無空檔，請選擇其他日期</div>';
    }
}

// 6. 選擇時段
function selectTime(btn, time) {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('selectedTime').value = time;
}

// 7. 送出表單
document.getElementById('bookingForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = document.querySelector('.submit-btn');

    const serviceElement = document.getElementById('service');
    const service = serviceElement.options[serviceElement.selectedIndex].text;
    const staff = document.getElementById('staff').options[document.getElementById('staff').selectedIndex].text;
    const date = document.getElementById('date').value;
    const time = document.getElementById('selectedTime').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const nickname = document.getElementById('nickname')?.value || '';

    if (nickname.length > 0) {
        alert("提交失敗，請勿重複提交。");
        return;
    }
    if (!time) { alert('請選擇預約時段！'); return; }

    submitBtn.disabled = true;
    submitBtn.innerText = "預約傳送中...";

    const formData = { service, staff, date, time, name, phone };

    try {
        const res = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(formData),
            mode: 'no-cors',
            headers: { 'Content-Type':'text/plain' }
        });
        // no-cors 無法讀取回應，僅假設成功
        alert(`✅ 預約成功！\n\n感謝 ${name} 的預約`);
        document.getElementById('bookingForm').reset();
        document.getElementById('timeSlotsContainer').innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">請先選擇日期</div>';
    } catch(err) {
        console.error(err);
        alert('❌ 系統忙碌中，請稍後再試，或直接聯繫我們。');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "確認預約";
    }
});

// 8. 初始化日期
window.addEventListener('load', function() {
    const dateInput = document.getElementById('date');
    dateInput.min = "2025-12-19";
    dateInput.value = "2025-12-19";
    updateServiceInfo();
});
