// --- JavaScript 邏輯區 ---

// 全域變數：Google Apps Script 網址
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
    const selectedDateStr = dateInput.value; // 記錄這次呼叫所針對的日期
    
    container.innerHTML = '';

    if (!selectedDateStr) {
        container.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">請選擇日期</div>';
        return;
    }

    // 處理最小日期限制
    const parts = selectedDateStr.split('-');
    const selectedDate = new Date(parts[0], parts[1]-1, parts[2]);

    container.innerHTML = '<div style="grid-column:1/-1;color:var(--primary-color);text-align:center;font-weight:bold;">預約資料加載中...</div>';

    // 判斷平日/假日
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday
    let fixedSlots = [];
    if (dayOfWeek >= 1 && dayOfWeek <= 5) fixedSlots = ['19:00'];
    else if (dayOfWeek === 0 || dayOfWeek === 6) fixedSlots = ['10:00','13:30'];
    else {
        // 如果這個邏輯分支不開放預約，就不需要後續的競態檢查
        container.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">該日期不開放預約</div>';
        return;
    }

    // 讀取當日已預約資料
    const bookedAppointments = await fetchBookedAppointments(selectedDateStr);
    
    // ⭐ 關鍵修正：檢查日期是否在等待期間被更改 (解決非同步操作的競態條件) ⭐
    if (dateInput.value !== selectedDateStr) {
        // 如果在等待 Google Sheet 回應期間，使用者已經切換到另一個日期，
        // 則忽略這次過時的結果，避免覆蓋最新的加載狀態。
        console.log(`Aborting rendering for ${selectedDateStr} because date was changed to ${dateInput.value}`);
        return; 
    }
    
    // 只有在日期沒有改變的情況下，才繼續清除加載提示並渲染時段
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
document.getElementById('bookingForm').addEventListener('submit', function(e) {
    e.preventDefault(); 

    const submitBtn = document.querySelector('.submit-btn');
    
    // 獲取舊資料
    const serviceElement = document.getElementById('service');
    const service = serviceElement.options[serviceElement.selectedIndex].text;
    const staff = document.getElementById('staff').options[document.getElementById('staff').selectedIndex].text;
    const date = document.getElementById('date').value;
    const time = document.getElementById('selectedTime').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;

    // ✨ 獲取新資料 ✨
    const email = document.getElementById('email').value.trim();
    const historySelect = document.getElementById('history');
    const history = historySelect.options[historySelect.selectedIndex].text; // 取得 "是" 或 "否" 的文字

    // 蜜罐檢查 (保持不變)
    const nickname = document.getElementById('nickname') ? document.getElementById('nickname').value : '';
    if (nickname.length > 0) {
        alert("提交失敗。"); return;
    }

    if (!time) {
        alert('請選擇預約時段！');
        return;
    }

    // ✨ 新增：Email 格式驗證 ✨
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert('請輸入有效的電子郵件地址！');
        return;
    }

    // 鎖定按鈕
    submitBtn.disabled = true;
    submitBtn.innerText = "預約傳送中...";

    // ✨ 更新 formData 包裹新資料 ✨
    const formData = {
        service: service, 
        staff: staff, 
        date: date, 
        time: time, 
        name: name, 
        phone: phone,
        email: email,     // 新增
        history: history  // 新增
    };

    // 發送資料 (使用全域變數 GOOGLE_SCRIPT_URL)
    fetch(GOOGLE_SCRIPT_URL, { 
        method: 'POST',
        body: JSON.stringify(formData),
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' }
    })
.then(() => {
        alert(`✅ 預約成功！\n\n感謝 ${name} 的預約\n確認信將發送至：${email}`);
        
        // 手動清空資料欄位
        document.getElementById('name').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('email').value = '';
        document.getElementById('history').selectedIndex = 0; 
        
        // 重置時段顯示與按鈕
        document.getElementById('timeSlotsContainer').innerHTML = '<div style="grid-column: 1/-1; color: #888; text-align: center;">請先選擇日期</div>';
        submitBtn.disabled = false;
        submitBtn.innerText = "確認預約";
        
        // 判斷日期限制
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const realTodayStr = `${yyyy}-${mm}-${dd}`; // 真正的今天 (例如 2025-12-01)
        
        const limitDateStr = "2025-12-19"; // 指定的限制日期

        // 比較：如果「今天」比「限制日期」還早，就使用限制日期；否則使用今天
        // 這樣等到 12/20 之後，系統就會自動開放當天預約，不用再改程式碼
        let effectiveDate = realTodayStr;
        if (realTodayStr < limitDateStr) {
            effectiveDate = limitDateStr;
        }
        
        const dateInput = document.getElementById('date');
        dateInput.min = effectiveDate;   // 設定最小值
        dateInput.value = effectiveDate; // 設定預設值
        
        // 重新觸發時段更新
        updateServiceInfo();
    })
    .catch(error => {
        console.error('Error!', error.message);
        alert('❌ 系統忙碌中，請稍後再試。');
        submitBtn.disabled = false;
        submitBtn.innerText = "確認預約";
    });
});

// 8. 初始化日期
window.addEventListener('load', function() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const realTodayStr = `${yyyy}-${mm}-${dd}`;
    
    const limitDateStr = "2025-12-19";
    
    let effectiveDate = realTodayStr;
    if (realTodayStr < limitDateStr) {
        effectiveDate = limitDateStr;
    }

    const dateInput = document.getElementById('date');
    dateInput.min = effectiveDate;
    dateInput.value = effectiveDate;
    
    updateServiceInfo();
});
