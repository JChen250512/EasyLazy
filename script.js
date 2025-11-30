// --- JavaScript 邏輯區 ---

// ⭐ 全域變數：您的 Google Apps Script 網址 ⭐
// ⚠️ 務必將這裡替換成您自己的 GOOGLE SCRIPT 網址 ⚠️
const GOOGLE_SCRIPT_URL = "placeholder_url"; // 這是佔位符，會被替換

// 1. 服務時間對照表 (不再用於衝突計算，但保留)
const SERVICE_DETAILS = {
    'single_custom': { text: '日式單根嫁接-客製款', time: 1 } 
};

// 2. 輔助函式：時間處理 (將 HH:MM 轉為分鐘數 - 雖然不再用於衝突，但保留以防未來擴充)
function timeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const [hour, minute] = timeStr.split(':').map(Number);
    return hour * 60 + minute;
}

// 3. 更新服務資訊顯示 (現在只負責確保 generateTimeSlots 被觸發)
function updateServiceInfo() {
    generateTimeSlots();
}


// 4. 從 Google Sheet 讀取所有預約資料 (GET 請求)
async function fetchBookedAppointments(date) {
    // 使用全域變數
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'GET'
        });
        
        if (!response.ok) {
            console.error('Fetch error:', response.statusText);
            return [];
        }
        
        const responseData = await response.json();
        
        // 核心修正：從 responseData 中取出 records 陣列 (配合您現在的 Apps Script 結構)
        const allAppointments = responseData.records || responseData; 

        // 前端選取的日期 (YYYY-MM-DD)
        const frontendSelectedDate = date; 

        // 由於 Apps Script 現在已經是乾淨的格式，我們只需要嚴格比對
        const todayBookings = allAppointments.filter(app => {
            if (!app['預約日期'] || !app['預約時段']) return false;
            
            // 嚴格比對 Apps Script 返回的 "預約日期" 字串和前端選取的日期
            return String(app['預約日期']).trim() === frontendSelectedDate; 
        });

        return todayBookings;

    } catch (error) {
        console.error('讀取預約資料失敗:', error);
        return [];
    }
}


// 5. 模擬產生時段 (固定排班、過去時間檢查、精確衝突檢查)
async function generateTimeSlots() {
    const container = document.getElementById('timeSlotsContainer');
    const dateInput = document.getElementById('date');
    const selectedDateStr = dateInput.value; // YYYY-MM-DD
    
    container.innerHTML = ''; // 清空舊按鈕
    
    if (!selectedDateStr) {
         container.innerHTML = '<div style="grid-column: 1/-1; color: #888; text-align: center;">請選擇日期</div>';
         return;
    }

    // ⭐ 關鍵修正：顯示加載提示 ⭐
    container.innerHTML = '<div style="grid-column: 1/-1; color: var(--primary-color); text-align: center; font-weight: bold;">預約資料加載中...</div>';
    
    // 判斷是平日還是假日，設定固定可選時段
    const selectedDate = new Date(selectedDateStr);
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    let fixedSlots = [];
    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // 平日 (一到五)
        fixedSlots = ['19:00']; // 只有晚上 7 點
    } else if (dayOfWeek === 0 || dayOfWeek === 6) { // 假日 (六、日)
        fixedSlots = ['10:00', '13:30']; // 早上 10:00 和 下午 1:30 (13:30)
    } else {
        container.innerHTML = '<div style="grid-column: 1/-1; color: #888; text-align: center;">該日期不開放預約</div>';
        return;
    }
    
    // 讀取當日已預約的資料
    const bookedAppointments = await fetchBookedAppointments(selectedDateStr);
    
    // ⭐ 關鍵修正：再次清空加載提示，準備顯示時段按鈕或錯誤訊息 ⭐
    container.innerHTML = ''; 
    
    // 從已預約的資料中提取時段字串
    const bookedTimes = bookedAppointments.map(app => app['預約時段']);
    
    const now = new Date();
    let availableCount = 0;

    // 迴圈遍歷固定的排班時段
    for (const timeLabel of fixedSlots) {
        
        // 1. 創建包含日期與時間的 Date 物件，用於檢查是否已過
        const [hour, minute] = timeLabel.split(':').map(Number);
        const slotDateTime = new Date(selectedDateStr);
        slotDateTime.setHours(hour, minute, 0, 0); 
        
        let isBooked = false;
        let isDisabled = false; 
        let disabledReason = '';
        
        // --- 檢查是否是過去的時間 (防呆機制) ---
        if (slotDateTime <= now) {
            isDisabled = true;
            disabledReason = '此時段已過';
        } 
        
        // --- 核心衝突檢查：檢查預約時段字串是否已存在 ---
        if (!isDisabled) {
            if (bookedTimes.includes(timeLabel)) {
                isBooked = true;
                disabledReason = '時段已被預約';
            }
        }
        
        // 渲染按鈕
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'time-btn';
        btn.innerText = timeLabel;
        
        if (isDisabled || isBooked) {
            btn.disabled = true;
            btn.title = disabledReason;
        } else {
            btn.onclick = function() {
                selectTime(this, timeLabel);
            };
            availableCount++;
        }
        
        container.appendChild(btn);
    } // 結束固定時段迴圈
    
    if (availableCount === 0) {
        // 如果沒有可用的時段，顯示最終提示
        container.innerHTML = '<div style="grid-column: 1/-1; color: #888; text-align: center;">本日已無空檔，請選擇其他日期</div>';
    }
}


// 6. 處理時段選擇 (與舊版相同)
function selectTime(btn, time) {
    const allBtns = document.querySelectorAll('.time-btn');
    allBtns.forEach(b => b.classList.remove('selected'));
    
    btn.classList.add('selected');
    document.getElementById('selectedTime').value = time;
}

// 7. 送出表單
document.getElementById('bookingForm').addEventListener('submit', function(e) {
    e.preventDefault(); 

    const submitBtn = document.querySelector('.submit-btn');
    
    // 獲取資料
    const serviceElement = document.getElementById('service');
    const service = serviceElement.options[serviceElement.selectedIndex].text;
    const staff = document.getElementById('staff').options[document.getElementById('staff').selectedIndex].text;
    const date = document.getElementById('date').value;
    const time = document.getElementById('selectedTime').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;

    const nickname = document.getElementById('nickname') ? document.getElementById('nickname').value : '';
    
    // 蜜罐檢查
    if (nickname.length > 0) {
        console.warn("偵測到機器人行為，已阻止提交。");
        alert("提交失敗，請勿重複提交。"); 
        return;
    }

    if (!time) {
        alert('請選擇預約時段！');
        return;
    }

    // 使用全域變數
    submitBtn.disabled = true;
    submitBtn.innerText = "預約傳送中...";

    const formData = {
        service: service, staff: staff, date: date, time: time, name: name, phone: phone
    };

    // 發送資料到 Google Sheet (使用 POST)
    fetch(GOOGLE_SCRIPT_URL, { // 使用全域變數
        method: 'POST',
        body: JSON.stringify(formData),
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' }
    })
    .then(() => {
        alert(`✅ 預約成功！\n\n感謝 ${name} 的預約\n我們已將資訊傳送至系統。`);
        document.getElementById('bookingForm').reset();
        // 重新初始化，讓畫面回到選取狀態
        document.getElementById('timeSlotsContainer').innerHTML = '<div style="grid-column: 1/-1; color: #888; text-align: center;">請先選擇日期</div>';
        submitBtn.disabled = false;
        submitBtn.innerText = "確認預約";
    })
    .catch(error => {
        console.error('Error!', error.message);
        alert('❌ 系統忙碌中，請稍後再試，或直接聯繫我們。');
        submitBtn.disabled = false;
        submitBtn.innerText = "確認預約";
    });
});

// 8. 初始化設定：設定最小可選日期為今天
window.onload = function() {
    // 設定日期輸入欄位的 min 屬性
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('date').min = `${yyyy}-${mm}-${dd}`;

    // 觸發更新
    updateServiceInfo();

};
