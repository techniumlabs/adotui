class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.1.9"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.9/adotui-macos-x64"
      sha256 "5c2e8dbf14dbc8d05ac912da5557441934b37ec0d3b28c062779d29f8056d710"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.9/adotui-macos-arm64"
      sha256 "07ef63b14fd3adedd73333f330a52b876111a43c5a3f17b99b5d627fd4a610f0"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.9/adotui-linux-x64"
      sha256 "308de3655221073f3dec983ba1d2515097bb241823d9eda2fe86bc612c662d56"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.9/adotui-linux-arm64"
      sha256 "b7c37a5505597078355ed9f46011dc2613cd9c81d38e2792c034835777cfc641"
    end
  end

  def install
    if OS.mac? && Hardware::CPU.intel?
      bin.install "adotui-macos-x64" => "adotui"
    elsif OS.mac? && Hardware::CPU.arm?
      bin.install "adotui-macos-arm64" => "adotui"
    elsif OS.linux? && Hardware::CPU.intel?
      bin.install "adotui-linux-x64" => "adotui"
    elsif OS.linux? && Hardware::CPU.arm?
      bin.install "adotui-linux-arm64" => "adotui"
    end
  end
end
