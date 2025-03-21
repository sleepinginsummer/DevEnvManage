<template>
  <div class="about">
    <h1 class="title">关于</h1>
    <div class="content">
      <div class="info-section">
        <h2>功能说明</h2>
        <ul class="feature-list">
          <li>JDK版本控制使用scoop+powershell实现，可以自行安装或者通过本软件直接安装</li>
          <li>Python版本控制使用pyenv实现，需要自行安装。详见python版本控制页面</li>
          <li>NodeJS版本控制使用nvm实现，需要自行安装。详见nvm版本控制页面</li>
          <li>如果安装scoop,jdk,python时遇到网络问题安装失败，可以在代理设置中配置代理</li>
        </ul>
      </div>
      <div class="github-section">
        <span>其他问题或最新版本请访问：</span>
        <a href="https://github.com/sleepinginsummer/DevEnvManage" target="_blank" class="github-link">
          GitHub 仓库
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.about {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.title {
  font-size: 2rem;
  margin-bottom: 2rem;
  color: #eee;
  border-bottom: 2px solid #eee;
  padding-bottom: 0.5rem;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.info-section h2 {
  font-size: 1.5rem;
  color: #eee;
  margin-bottom: 1rem;
}

.feature-list {
  list-style: none;
  padding: 0;
}

.feature-list li {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
  position: relative;
}

.feature-list li::before {
  content: "•";
  position: absolute;
  left: 0;
  color: #42b983;
}

.github-section {
  margin-top: 2rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.github-section span {
  color: #eee;
}
.github-link {
  display: inline-block;
  color: #42b983;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.3s;
}

.github-link:hover {
  color: #3aa876;
}
</style>