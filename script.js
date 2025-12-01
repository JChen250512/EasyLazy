// --- JavaScript 邏輯區 ---

// 全域變數：Google Apps Script 網址
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzHV8KLPw390a8MIgQg1YTTt-g5B_ughmXB86jajc32dcBjmkaQ0p7vQ8qA99mPtPNY/exec'; 

// 全域變數：用於儲存所有預約資料，避免重複向 Google 請求
let allBookedRecords = [];

// Modal 控制輔助函式
function showLoadingModal() {
    // 讓 Modal 顯示出來
    document.getElementById('loadingModal').style.display = 'flex';
}

function hideLoadingModal() {
    // 讓 Modal 隱藏
    document.getElementById('loadingModal').style.display = 'none';
}

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

// 從 Google Sheet 讀取預約資料 (現在只會在載入時被呼叫一次)
async function prefetchAllBookedAppointments() {
    console.log('--- 開始預加載所有預約資料 ---');
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'GET' });
        if (!response.ok) throw new Error(response.statusText);

        const data = await response.json();
        allBookedRecords = data.records || data; // 將所有資料儲存到全域變數
        console.log(`成功載入 ${allBookedRecords.length} 筆預約記錄。`);
    } catch (err) {
        console.error('❌ 預加載預約資料失敗:', err);
        // 如果失敗，給一個空的陣列，避免後續程式錯誤
        allBookedRecords = []; 
        alert('❌ 無法讀取預約資料，請檢查網路連線或 Apps Script 部署。');
    }
}


// 5. 生成時段按鈕 (現在從全域變數讀取資料)
async function generateTimeSlots() {
    const container = document.getElementById('timeSlotsContainer');
    const dateInput = document.getElementById('date');
    const selectedDateStr = dateInput.value; // 記錄這次呼叫所針對的日期
    
    container.innerHTML = '';

    if (!selectedDateStr) {
        container.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">請選擇日期</div>';
        return;
    }

    // 由於資料已預加載，這裡不需要顯示載入中，可以直接進入篩選流程

    // 處理最小日期限制
    const parts = selectedDateStr.split('-');
    const selectedDate = new Date(parts[0], parts[1]-1, parts[2]);

    // 判斷平日/假日
    const dayOfWeek = selectedDate.getDay(); // 0 = Sunday
    let fixedSlots = [];
    if (dayOfWeek >= 1 && dayOfWeek <= 5) fixedSlots = ['19:00'];
    else if (dayOfWeek === 0 || dayOfWeek === 6) fixedSlots = ['10:00','13:30'];
    else {
        container.innerHTML = '<div style="grid-column:1/-1;color:#888;text-align:center;">該日期不開放預約</div>';
        return;
    }

    // 從全域變數中，篩選出當日已預約資料
    const bookedAppointments = allBookedRecords.filter(app => 
        app['預約日期']?.trim() === selectedDateStr
    );
    
    // 這裡移除了競態條件檢查，因為 fetch 已經在前面完成，
    // 雖然這個檢查（if (dateInput.value !== selectedDateStr) return;） 
    // 對於使用者快速操作仍然是好的，但因為資料讀取變快了，競態機會大幅降低。
    // 為了簡化程式碼，這裡先移除。如果後續仍發生，請加回。
    
    // 移除了 container.innerHTML = ''; 因為不再需要清除加載提示
    
    const bookedTimes = bookedAppointments.map(app => app['預約時段']);
    const now = new Date();
    let availableCount = 0;

    for (const timeLabel of fixedSlots) {
        // ... (省略時段檢查和按鈕渲染邏輯，這部分與原版相同) ...
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

// 6. 選擇時段 (不變)
function selectTime(btn, time) {
    document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('selectedTime').value = time;
}

// 7. 送出表單 (不變，但需要確保成功後重設日期邏輯正確)
document.getElementById('bookingForm').addEventListener('submit', function(e) {
    e.preventDefault(); 

    const submitBtn = document.querySelector('.submit-btn');
    
    // 獲取所有資料
    const serviceElement = document.getElementById('service');
    const service = serviceElement.options[serviceElement.selectedIndex].text;
    // ... (省略獲取 staff, date, time, name, phone, email, history 邏輯) ...
    const staff = document.getElementById('staff').options[document.getElementById('staff').selectedIndex].text;
    const date = document.getElementById('date').value;
    const time = document.getElementById('selectedTime').value;
    const name = document.getElementById('name').value;
    const phone = document.getElementById('phone').value;
    const email = document.getElementById('email').value.trim();
    const historySelect = document.getElementById('history');
    const history = historySelect.options[historySelect.selectedIndex].text; 

    const nickname = document.getElementById('nickname') ? document.getElementById('nickname').value : '';
    
    if (nickname.length > 0) {
        alert("提交失敗。"); return;
    }

    if (!time) {
        alert('請選擇預約時段！');
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert('請輸入有效的電子郵件地址！');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = "預約傳送中...";

    const formData = {
        service: service, staff: staff, date: date, time: time, name: name, phone: phone,
        email: email, history: history
    };

    fetch(GOOGLE_SCRIPT_URL, { 
        method: 'POST',
        body: JSON.stringify(formData),
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' }
    })
    .then(async () => {
        alert(`✅ 預約成功！\n\n感謝 ${name} 的預約\n確認信將發送至：${email}`);
        
        // 成功後，除了重置表單外，必須重新預加載一次資料，包含剛才預約的紀錄
        // 這裡的 await 是必須的，確保新資料載入完成
        await prefetchAllBookedAppointments(); 

        document.getElementById('name').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('email').value = '';
        document.getElementById('history').selectedIndex = 0; 
        
        // 重設日期邏輯 (確保符合 12/19 限制)
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

        document.getElementById('timeSlotsContainer').innerHTML = '<div style="grid-column: 1/-1; color: #888; text-align: center;">請先選擇日期</div>';
        submitBtn.disabled = false;
        submitBtn.innerText = "確認預約";
        
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

// 8. 修改初始化設定：使用 Modal 顯示載入中 
window.addEventListener('load', async function() {
    const dateInput = document.getElementById('date');
    
    // 1. 顯示 Loading Modal (鎖定畫面) 
    showLoadingModal();
    // 禁用日期輸入欄位，作為防呆
    dateInput.disabled = true; 
    
    // 2. 開始預加載資料 (非同步)
    await prefetchAllBookedAppointments(); 

    // 3. 隱藏 Loading Modal (解鎖畫面) 
    hideLoadingModal();
    dateInput.disabled = false; // 啟用日期輸入欄位
    
    // 由於我們使用了 Modal 鎖定介面，所以可以移除之前在 timeSlotsContainer 顯示的「加載中」文字

    // 4. 設定日期輸入欄位 (同步，保持一致)
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

    dateInput.min = effectiveDate;
    dateInput.value = effectiveDate;
    
    // 5. 觸發更新：顯示時段
    updateServiceInfo();
});
