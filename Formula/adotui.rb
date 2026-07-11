class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.1.6"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.6/adotui-macos-x64"
      sha256 "2524be19c4179755874f374df6c7647d78fd0f23998040f6919d1137a3f154dc"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.6/adotui-macos-arm64"
      sha256 "3472513e23133839f4a51542cbde5ae1c21ec7fa53ba4d844546378080110b6e"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.6/adotui-linux-x64"
      sha256 "ee192f6adf8ee13b2a4e7e4b9559d1f4798de452b27f743576d8b6fd45334878"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.6/adotui-linux-arm64"
      sha256 "722fa2cb94e1cedd1dc87ae245eb5cd860d7216791ae442934cc72f239fb2e07"
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
