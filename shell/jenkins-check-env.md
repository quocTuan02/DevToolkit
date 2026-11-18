# Hướng dẫn kiểm tra nội dung env (Secret File) trên Jenkins

Dùng khi cần xem nội dung của credential dạng **Secret file** (ví dụ `fe-website-eng-dev`) mà không muốn in ra log build.

## Yêu cầu

- Tài khoản có quyền **Administer** (Overall/Administer).
- Biết **ID** của credential (ví dụ: `fe-website-eng-dev`).

## Cách: đọc trực tiếp bằng Script Console

1. Vào **Manage Jenkins → Script Console**
   (hoặc truy cập `<JENKINS_URL>/script`).
2. Dán đoạn script dưới đây và bấm **Run**.

### Trường hợp 1: Credential ở scope Global

```groovy
import com.cloudbees.plugins.credentials.CredentialsProvider
import org.jenkinsci.plugins.plaincredentials.FileCredentials
import jenkins.model.Jenkins

def creds = CredentialsProvider.lookupCredentials(FileCredentials.class, Jenkins.instance, null, null)
def c = creds.find { it.id == 'fe-website-eng-dev' }
println c ? c.content.text : "Không tìm thấy credential"
```

### Trường hợp 2: Credential nằm trong một Folder

Thay `Jenkins.instance` bằng item của folder đó:

```groovy
import com.cloudbees.plugins.credentials.CredentialsProvider
import org.jenkinsci.plugins.plaincredentials.FileCredentials
import jenkins.model.Jenkins

def folder = Jenkins.instance.getItemByFullName('ten-folder')
def creds = CredentialsProvider.lookupCredentials(FileCredentials.class, folder, null, null)
def c = creds.find { it.id == 'fe-website-eng-dev' }
println c ? c.content.text : "Không tìm thấy credential"
```

> Folder lồng nhau: dùng full name, ví dụ `'folder-cha/folder-con'`.

### (Tuỳ chọn) Liệt kê tất cả Secret file để tìm đúng ID

```groovy
import com.cloudbees.plugins.credentials.CredentialsProvider
import org.jenkinsci.plugins.plaincredentials.FileCredentials
import jenkins.model.Jenkins

CredentialsProvider.lookupCredentials(FileCredentials.class, Jenkins.instance, null, null)
    .each { println "${it.id}  |  ${it.fileName}  |  ${it.description}" }
```

## Lưu ý

- Cách này **không để lại gì trong log build** (khác với việc `cat` file trong pipeline, vốn có thể lộ secret).
- Nội dung env thường chứa secret (API key, password...) → **không** copy dán lên chat/ticket/repo công khai.
- Script Console chạy với toàn quyền hệ thống, chỉ chạy đúng đoạn script đã đọc hiểu.
- Nếu hiện `Không tìm thấy credential`: kiểm tra lại ID, hoặc credential đang nằm trong Folder (dùng Trường hợp 2).
